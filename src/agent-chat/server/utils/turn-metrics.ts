import type { ClaudeEvent } from '#claude-threads/claude/cli';
import type { TurnOutcome } from '../../shared/types/conversation';

const FAILED_FALLBACK_MESSAGE = 'The answer could not be completed.';

export interface TurnMetrics {
    model: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    cacheReadTokens: number | null;
    cacheCreationTokens: number | null;
    costUsd: number | null;
    durationMs: number | null;
    outcome: TurnOutcome;
    errorMessage: string | null;
}

interface ModelUsage {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadInputTokens?: number;
    cacheCreationInputTokens?: number;
    costUSD?: number;
}

export function outcomeOnlyMetrics(outcome: TurnOutcome, model: string | null, errorMessage: string | null = null): TurnMetrics {
    return {
        model,
        inputTokens: null,
        outputTokens: null,
        cacheReadTokens: null,
        cacheCreationTokens: null,
        costUsd: null,
        durationMs: null,
        outcome,
        errorMessage,
    };
}

function resultError(event: ClaudeEvent): string {
    return typeof event.result === 'string' && event.result.trim() ? event.result.trim() : FAILED_FALLBACK_MESSAGE;
}

export function metricsFromResult(event: ClaudeEvent, model: string | null, stopRequested: boolean): TurnMetrics {
    const usage = Object.values((event.model_usage_since_last_result ?? {}) as Record<string, ModelUsage>);
    const sum = (pick: (entry: ModelUsage) => number | undefined): number | null => usage.length === 0
        ? null
        : usage.reduce((total, entry) => total + (pick(entry) ?? 0), 0);
    const failed = event.is_error === true || event.subtype !== 'success';
    return {
        model,
        inputTokens: sum(entry => entry.inputTokens),
        outputTokens: sum(entry => entry.outputTokens),
        cacheReadTokens: sum(entry => entry.cacheReadInputTokens),
        cacheCreationTokens: sum(entry => entry.cacheCreationInputTokens),
        costUsd: sum(entry => entry.costUSD),
        durationMs: typeof event.duration_ms === 'number' ? event.duration_ms : null,
        outcome: stopRequested ? 'stopped' : failed ? 'failed' : 'completed',
        errorMessage: !stopRequested && failed ? resultError(event) : null,
    };
}
