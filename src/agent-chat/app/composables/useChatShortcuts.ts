const SHORTCUT_COUNT = 9;

function isApplePlatform(): boolean {
    return /Mac|iPhone|iPad/.test(navigator.platform);
}

export function useChatShortcuts(conversationIds: Ref<string[]>) {
    const route = useRoute();
    const held = ref(false);
    const apple = import.meta.client && isApplePlatform();
    const modifierKey = apple ? 'Meta' : 'Control';

    function shortcutLabel(conversationId: string): string | null {
        const index = conversationIds.value.indexOf(conversationId);
        if (index === -1 || index >= SHORTCUT_COUNT) {
            return null;
        }
        return apple ? `⌘${index + 1}` : `Ctrl ${index + 1}`;
    }

    function stepTo(direction: 1 | -1): void {
        const ids = conversationIds.value;
        const current = ids.indexOf(String(route.params.id ?? ''));
        const target = current === -1 ? (direction === 1 ? ids[0] : ids.at(-1)) : ids[current + direction];
        if (target) {
            void navigateTo(`/c/${target}`);
        }
    }

    function onKeydown(event: KeyboardEvent): void {
        if (event.key === modifierKey) {
            held.value = true;
            return;
        }
        if (event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            event.preventDefault();
            stepTo(event.key === 'ArrowDown' ? 1 : -1);
            return;
        }
        const modifier = apple ? event.metaKey : event.ctrlKey;
        const number = Number(event.key);
        if (!modifier || event.shiftKey || event.altKey || !Number.isInteger(number) || number < 1 || number > SHORTCUT_COUNT) {
            return;
        }
        const target = conversationIds.value[number - 1];
        if (target) {
            event.preventDefault();
            void navigateTo(`/c/${target}`);
        }
    }

    function release(event?: KeyboardEvent): void {
        if (!event || event.key === modifierKey) {
            held.value = false;
        }
    }

    function releaseAll(): void {
        release();
    }

    onMounted(() => {
        window.addEventListener('keydown', onKeydown);
        window.addEventListener('keyup', release);
        window.addEventListener('blur', releaseAll);
    });

    onBeforeUnmount(() => {
        window.removeEventListener('keydown', onKeydown);
        window.removeEventListener('keyup', release);
        window.removeEventListener('blur', releaseAll);
    });

    return { held: readonly(held), shortcutLabel };
}
