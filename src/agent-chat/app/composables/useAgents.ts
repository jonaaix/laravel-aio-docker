import type { Agent, AgentInput } from '#shared/types/agent';

export function useAgents() {
    const agents = useState<Agent[]>('agents', () => []);
    const lead = computed(() => agents.value.find(agent => agent.lead) ?? null);

    function load(): Promise<void> {
        return loadWithSnapshot('agents', () => apiFetch<Agent[]>('agents'), (list) => {
            agents.value = list;
        });
    }

    async function save(id: string | null, input: AgentInput): Promise<Agent> {
        const saved = id
            ? await apiFetch<Agent>(`agents/${id}`, { method: 'PUT', body: input })
            : await apiFetch<Agent>('agents', { method: 'POST', body: input });
        await load();
        return saved;
    }

    async function remove(id: string): Promise<void> {
        await apiFetch(`agents/${id}`, { method: 'DELETE' });
        await load();
    }

    return { agents, lead, load, save, remove };
}
