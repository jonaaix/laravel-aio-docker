<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';
import type { ConversationListEvent } from '#shared/types/conversation';

const { conversations, upsert, load } = useConversations();
const { usage, load: loadAccount } = useAccount();
const { baseURL } = useRuntimeConfig().app;

const CLOCK_TICK_MS = 60_000;
const NAME_PARAM = 'n';

const route = useRoute();
const router = useRouter();
const { adopt: adoptUserName, restore: restoreUser } = useUserName();
const encodedName = route.query[NAME_PARAM];
if (typeof encodedName === 'string') {
    void adoptUserName(encodedName);
    const query = { ...route.query };
    delete query[NAME_PARAM];
    void router.replace({ query });
}
else {
    void restoreUser();
}

const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | undefined;

const items = computed<NavigationMenuItem[][]>(() => groupByRecency(conversations.value).map(group => [
    { label: group.label, type: 'label' },
    ...group.conversations.map(conversation => ({
        label: conversation.title,
        to: `/c/${conversation.id}`,
        session: sessionState(conversation.status, conversation.turnActive),
        creatorName: conversation.creatorName,
        lastActivityAt: conversation.lastActivityAt,
    })),
]));

let unsubscribe: (() => void) | undefined;

onMounted(async () => {
    unsubscribe = subscribeEvents<ConversationListEvent>('events', (event) => {
        if (event.type === 'conversation') {
            upsert(event.conversation);
        }
        else {
            usage.value = event.usage;
        }
    }, () => {
        void Promise.all([load(), loadAccount()]);
    });
    await Promise.all([load(), loadAccount()]);
    clock = setInterval(() => {
        now.value = Date.now();
    }, CLOCK_TICK_MS);
});

onBeforeUnmount(() => {
    unsubscribe?.();
    clearInterval(clock);
});
</script>

<template>
    <UDashboardGroup unit="rem" :storage-key="`ai-chat-${baseURL}`">
        <UDashboardSidebar
            id="conversations"
            collapsible
            resizable
            :min-size="14"
            :default-size="18"
            :max-size="28"
            :ui="{ root: 'bg-elevated/50', footer: 'pb-4' }"
        >
            <template #header="{ collapsed }">
                <UTooltip text="New Code Session" :disabled="!collapsed">
                    <UButton
                        to="/"
                        icon="i-heroicons-pencil-square"
                        :label="collapsed ? undefined : 'New Code Session'"
                        aria-label="New Code Session"
                        color="neutral"
                        variant="soft"
                        block
                        :square="collapsed"
                        class="bg-white ring ring-black/5 hover:bg-neutral-100 dark:bg-elevated/50 dark:ring-0 dark:hover:bg-elevated"
                    />
                </UTooltip>
            </template>

            <template #default="{ collapsed }">
                <UTooltip text="Archived" :disabled="!collapsed">
                    <UButton
                        to="/archived"
                        icon="i-heroicons-archive-box"
                        :label="collapsed ? undefined : 'Archived'"
                        aria-label="Archived"
                        color="neutral"
                        variant="ghost"
                        :square="collapsed"
                        :block="!collapsed"
                        class="justify-start hover:bg-accented/60"
                    />
                </UTooltip>
                <UNavigationMenu
                    :items="items"
                    :collapsed="collapsed"
                    orientation="vertical"
                    :ui="{ link: 'overflow-hidden py-1.5 before:transition-colors before:duration-500 before:ease-out hover:before:bg-accented/60 aria-[current=page]:before:bg-accented/80 aria-[current=page]:text-highlighted', linkLabel: 'min-w-0 flex-1' }"
                >
                    <template #item-label="{ item }">
                        <template v-if="item.session">
                            <span class="block truncate">{{ item.label }}</span>
                            <span class="mt-0.5 flex items-center gap-1.5 text-xs font-normal text-muted">
                                <span class="size-1.5 shrink-0 rounded-full" :class="item.session.dotClass" />
                                <span>{{ item.session.label }}</span>
                                <template v-if="item.creatorName">
                                    <span aria-hidden="true">·</span>
                                    <span class="truncate">{{ item.creatorName }}</span>
                                </template>
                                <span aria-hidden="true">·</span>
                                <span class="truncate tabular-nums">{{ formatRelativeTime(item.lastActivityAt, now) }}</span>
                            </span>
                        </template>
                        <span v-else class="block truncate">{{ item.label }}</span>
                    </template>
                </UNavigationMenu>
            </template>

            <template #footer="{ collapsed }">
                <div class="flex w-full flex-col gap-2">
                    <SettingsMenu :collapsed="collapsed" />
                    <AccountCard v-if="!collapsed" />
                </div>
            </template>
        </UDashboardSidebar>

        <slot />
        <UserNameModal />
    </UDashboardGroup>
</template>
