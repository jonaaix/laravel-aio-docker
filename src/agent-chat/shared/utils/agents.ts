export const LEAD_AGENT_NAME = 'Karim SA';
export const LEAD_AGENT_ROLE = 'Lead Senior Software Architect';
export const AGENT_MODELS = ['opus', 'sonnet', 'haiku'] as const;
export const AGENT_ROLE_MAX_LENGTH = 200;

export function normalizeAgentModel(value: unknown): string | null {
    return typeof value === 'string' && (AGENT_MODELS as readonly string[]).includes(value) ? value : null;
}
