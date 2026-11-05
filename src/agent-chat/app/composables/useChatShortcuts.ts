const SHORTCUT_COUNT = 9;

function isApplePlatform(): boolean {
    return /Mac|iPhone|iPad/.test(navigator.platform);
}

export function useChatShortcuts(conversationIds: Ref<string[]>) {
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

    function onKeydown(event: KeyboardEvent): void {
        if (event.key === modifierKey) {
            held.value = true;
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
