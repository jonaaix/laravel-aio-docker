const TITLE_QUERY = 't';

export function useChatTitle() {
    const title = useState<string | null>('chat-title', () => null);

    async function load(): Promise<void> {
        title.value = (await apiFetch<{ title: string | null }>('chat-title')).title;
    }

    async function save(next: string): Promise<void> {
        title.value = (await apiFetch<{ title: string | null }>('chat-title', { method: 'PUT', body: { title: next } })).title;
    }

    async function adoptFromQuery(): Promise<void> {
        const route = useRoute();
        const given = route.query[TITLE_QUERY];
        if (typeof given !== 'string') {
            await load();
            return;
        }
        await save(given);
        await useRouter().replace({ query: Object.fromEntries(Object.entries(route.query).filter(([key]) => key !== TITLE_QUERY)) });
    }

    return { title, load, save, adoptFromQuery };
}
