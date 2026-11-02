export const LEAD_AGENT_NAME = 'Karim SA';
export const LEAD_AGENT_ROLE = 'Lead Senior Software Architect';
export const AGENT_ROLE_MAX_LENGTH = 200;
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

const MODEL_VALUE = /^[\w.[\]-]{1,100}$/;

export function normalizeAgentModel(value: unknown): string | null {
    return typeof value === 'string' && value !== 'default' && MODEL_VALUE.test(value) ? value : null;
}

export function normalizeAgentEffort(value: unknown): string | null {
    return typeof value === 'string' && (EFFORT_LEVELS as readonly string[]).includes(value) ? value : null;
}
