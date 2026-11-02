export function useMentionNames() {
    const { agents } = useAgents();
    const { users } = useUsers();
    return computed(() => [...agents.value.map(agent => agent.name), ...Object.values(users.value).map(user => user.name)].sort());
}

export function useChatMarkdownPlugins() {
    const names = useMentionNames();
    return [...markdownPlugins, mentionHighlight(() => names.value)];
}
