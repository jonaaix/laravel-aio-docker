export const LEAD_AGENT_NAME = 'Tarek LSA';
export const LEAD_AGENT_ROLE = 'Lead Senior Software Architect';
export const AGENT_ROLE_MAX_LENGTH = 200;
export const AVATAR_SEED_MAX_LENGTH = 64;
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
// Claude's own default drifts (sometimes medium), which visibly lowers quality, so agents pin high.
export const DEFAULT_EFFORT = 'high';

const MODEL_VALUE = /^[\w.[\]-]{1,100}$/;

export function normalizeAgentModel(value: unknown): string | null {
    return typeof value === 'string' && value !== 'default' && MODEL_VALUE.test(value) ? value : null;
}

export function normalizeAgentEffort(value: unknown): string | null {
    return typeof value === 'string' && (EFFORT_LEVELS as readonly string[]).includes(value) ? value : null;
}
