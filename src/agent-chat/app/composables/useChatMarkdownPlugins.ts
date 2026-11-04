export function useMentionNames() {
    const { agents } = useAgents();
    const { names } = useUsers();
    return computed(() => [...agents.value.map(agent => agent.name), ...Object.values(names.value)].sort());
}

export function useChatMarkdownPlugins() {
    const names = useMentionNames();
    return [...markdownPlugins, mentionHighlight(() => names.value)];
}
