import { ClaudeCli, type ClaudeEvent } from '#claude-threads/claude/cli';
import type { ClaudeModel } from '../../shared/types/model';

const MODEL_LIST_TIMEOUT_MS = 20_000;
const FALLBACK_MODELS: ClaudeModel[] = ['default', 'opus', 'sonnet', 'haiku'].map(value => ({ value, name: value, description: '', effortLevels: [] }));

let cached: Promise<ClaudeModel[]> | null = null;

function toModels(response: unknown): ClaudeModel[] {
    const models = (response as { models?: unknown } | undefined)?.models;
    if (!Array.isArray(models)) {
        return FALLBACK_MODELS;
    }
    return models.flatMap((model: Record<string, unknown>) => typeof model.value === 'string'
        ? [{
                value: model.value,
                name: typeof model.displayName === 'string' ? model.displayName : model.value,
                description: typeof model.description === 'string' ? model.description : '',
                effortLevels: Array.isArray(model.supportedEffortLevels) ? model.supportedEffortLevels.filter((level): level is string => typeof level === 'string') : [],
            }]
        : []);
}

function fetchModels(): Promise<ClaudeModel[]> {
    return new Promise((resolve) => {
        const probe = new ClaudeCli({ workingDir: resolveWorkingDir(), permissionMode: 'bypass' });
        const finish = (models: ClaudeModel[]): void => {
            clearTimeout(timer);
            void probe.kill();
            resolve(models);
        };
        const timer = setTimeout(() => finish(FALLBACK_MODELS), MODEL_LIST_TIMEOUT_MS);
        let requestRef: string | null = null;
        probe.on('event', (event: ClaudeEvent) => {
            const { request_id: ref, response } = (event.response ?? {}) as { request_id?: string; response?: unknown };
            if (event.type === 'control_response' && ref === requestRef) {
                finish(toModels(response));
            }
        });
        probe.on('error', () => finish(FALLBACK_MODELS));
        probe.start();
        requestRef = probe.sendControlRequest({ subtype: 'initialize' });
    });
}

export function listClaudeModels(): Promise<ClaudeModel[]> {
    cached ??= fetchModels().then((models) => {
        if (models === FALLBACK_MODELS) {
            cached = null;
        }
        return models;
    });
    return cached;
}
