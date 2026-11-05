<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';
import type { ConversationListEvent } from '#shared/types/conversation';

const { t } = useI18n();
const { conversations, upsert, load } = useConversations();
const { usage, load: loadAccount } = useAccount();
const { load: loadAgents } = useAgents();
const { load: loadUsers, upsert: upsertUser, chatName } = useUsers();
const { baseURL } = useRuntimeConfig().app;

const { user } = useUserName();
const devicesVersion = useState('devices-version', () => 0);
const { public: { hub } } = useRuntimeConfig();
const unread = useUnread();
unread.track();
useDoneSound().track();
followSpeechRate();
followSettingsWindow();
const speech = useSpeechPlayer();
const hubUnread = hub ? useHubUnread() : null;
hubUnread?.track();
const { load: loadReads, apply: applyRead } = useReads();
const unreadCount = computed(() => hubUnread ? hubUnread.total.value : unread.unreadIds.value.length);
useHead(computed(() => {
    const count = unreadCount.value;
    return { titleTemplate: (title?: string) => count > 0 ? `(${count}) ${title ?? ''}` : title ?? '' };
}));
const { adopt: adoptAppearance } = useAppearance();
watch(() => user.value?.id, () => {
    if (user.value) {
        adoptAppearance(user.value);
    }
}, { immediate: true });

const now = useNow();
const sidebarCollapsed = ref(false);

const items = computed<NavigationMenuItem[][]>(() => groupByRecency(conversations.value).map(group => [
    { label: t(group.label), type: 'label' },
    ...group.conversations.map(conversation => ({
        label: conversation.title,
        id: conversation.id,
        to: `/c/${conversation.id}`,
        session: sessionState(conversation.status, conversation.turnActive),
        paused: conversation.status !== 'running' && !conversation.turnActive,
        creatorName: chatName(conversation.creatorId),
        lastActivityAt: conversation.lastActivityAt,
        reading: speech.speakingId.value !== null && speech.conversationId.value === conversation.id,
    })),
]));

let unsubscribe: (() => void) | undefined;

onMounted(async () => {
    unsubscribe = subscribeEvents<ConversationListEvent>('events', (event) => {
        if (event.type === 'conversation') {
            upsert(event.conversation);
        }
        else if (event.type === 'user') {
            upsertUser(event.user);
            if (event.user.id === user.value?.id) {
                const adminChanged = event.user.admin !== user.value.admin;
                user.value = event.user.blocked ? null : event.user;
                adoptAppearance(event.user);
                if (adminChanged) {
                    void loadAccount();
                }
            }
        }
        else if (event.type === 'agents') {
            void loadAgents();
        }
        else if (event.type === 'account') {
            void loadAccount();
        }
        else if (event.type === 'devices') {
            if (event.userId === user.value?.id) {
                devicesVersion.value += 1;
            }
        }
        else if (event.type === 'read') {
            if (event.userId === user.value?.id) {
                applyRead(event.conversationId, event.seenAnswerAt);
            }
        }
        else {
            usage.value = event.usage;
        }
    }, () => {
        void Promise.all([load(), loadAccount(), loadUsers(), loadAgents(), loadReads()]);
    });
    await Promise.all([load(), loadAccount(), loadAgents(), loadUsers(), loadReads()]).catch(() => undefined);
});

onBeforeUnmount(() => {
    unsubscribe?.();
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
            v-model:collapsed="sidebarCollapsed"
            :ui="{ root: 'peer bg-muted', body: sidebarCollapsed ? 'px-2' : 'px-2.5', footer: ['pb-4', sidebarCollapsed ? 'px-2' : 'px-2.5'], header: [hub ? 'h-auto py-3' : '', sidebarCollapsed ? 'px-2' : 'px-2.5'] }"
        >
            <template #header="{ collapsed }">
                <div class="flex w-full flex-col gap-2">
                <HubServerSwitcher v-if="hub" :collapsed="collapsed" />
                <UTooltip :text="t('New Code Session')" :disabled="!collapsed">
                    <UButton
                        to="/"
                        icon="i-heroicons-pencil-square"
                        :label="collapsed ? undefined : t('New Code Session')"
                        :aria-label="t('New Code Session')"
                        color="neutral"
                        variant="soft"
                        :block="!collapsed"
                        :square="collapsed"
                        :class="collapsed ? 'self-center' : ''"
                        class="bg-default text-primary ring ring-primary/40 hover:bg-primary/10 dark:bg-elevated/50 dark:hover:bg-primary/10"
                    />
                </UTooltip>
                <template v-if="hub && !collapsed">
                    <UAlert v-if="hubOffline" :title="t('Offline')" :description="t('Showing saved chats.')" icon="i-heroicons-signal-slash" color="neutral" variant="subtle" />
                    <UAlert
                        v-if="updateReady"
                        :title="t('Update available')"
                        icon="i-heroicons-arrow-path"
                        color="neutral"
                        variant="subtle"
                        :actions="[{ label: t('Reload'), color: 'neutral', variant: 'outline', onClick: applyUpdate }]"
                    />
                </template>
                </div>
            </template>

            <template #default="{ collapsed }">
                <UNavigationMenu
                    :items="items"
                    :collapsed="collapsed"
                    tooltip
                    orientation="vertical"
                    :ui="{ link: ['overflow-hidden py-1.5 before:transition-colors before:duration-500 before:ease-out hover:before:bg-primary/8 aria-[current=page]:before:bg-primary/12 aria-[current=page]:text-(--nav-current)', collapsed ? 'mx-auto size-10 justify-center overflow-visible p-0 before:inset-0 before:rounded-full' : 'gap-3'], linkLabel: 'min-w-0 flex-1' }"
                >
                    <template #item-leading="{ item }">
                        <span
                            v-if="item.session"
                            class="relative flex shrink-0 items-center justify-center self-center rounded-full bg-default ring ring-default dark:bg-elevated/50"
                            :class="collapsed ? 'size-8' : 'size-7'"
                        >
                            <img :src="chatAvatarUri(item.id)" alt="" class="size-full rounded-full">
                            <template v-if="item.reading">
                                <VoiceRing class="absolute -inset-1" />
                                <span class="sr-only">{{ t('Reading aloud') }}</span>
                            </template>
                            <template v-if="collapsed">
                                <span v-if="unread.isUnread(item.id)" class="absolute -end-0.5 -top-0.5 size-2 rounded-full bg-primary ring-2 ring-(--ui-bg-muted)" :aria-label="t('Unread')" />
                                <span v-if="item.session.live" class="light-ring pointer-events-none absolute -inset-[3px] rounded-full" role="status" :aria-label="t(item.session.label)" />
                            </template>
                        </span>
                    </template>
                    <template #item-label="{ item }">
                        <template v-if="item.session">
                            <span class="flex items-center gap-1.5">
                                <span class="block truncate" :class="[unread.isUnread(item.id) ? 'font-semibold text-highlighted' : '', { 'light-streak text-muted!': item.session.live }]">{{ item.label }}</span>
                                <span v-if="unread.isUnread(item.id)" class="size-2 shrink-0 rounded-full bg-primary" :aria-label="t('Unread')" />
                            </span>
                            <span class="mt-0.5 flex items-center gap-1.5 text-xs font-normal text-muted">
                                <span class="flex min-w-0 items-center gap-1.5" :class="{ 'light-streak': item.session.live }">
                                    <template v-if="item.creatorName">
                                        <span class="min-w-0 truncate">{{ item.creatorName }}</span>
                                        <span aria-hidden="true">·</span>
                                    </template>
                                    <span class="shrink-0 tabular-nums">{{ formatRelativeTime(item.lastActivityAt, now) }}</span>
                                </span>
                                <ChatWorkingDots v-if="item.session.live" :label="t(item.session.label)" class="ms-auto" />
                                <ChatSessionPill v-else-if="!item.paused" :state="item.session" class="ms-auto" />
                            </span>
                        </template>
                        <span v-else class="block truncate">{{ item.label }}</span>
                    </template>
                </UNavigationMenu>
            </template>

            <template #footer="{ collapsed }">
                <div class="flex w-full flex-col gap-2">
                    <SpeechPlayer v-if="collapsed" collapsed class="max-lg:hidden" />
                    <div class="flex flex-col">
                        <UTooltip :text="t('Archived')" :disabled="!collapsed">
                            <UButton
                                to="/archived"
                                icon="i-heroicons-archive-box"
                                :label="collapsed ? undefined : t('Archived')"
                                :aria-label="t('Archived')"
                                color="neutral"
                                variant="ghost"
                                :square="collapsed"
                                :block="!collapsed"
                                class="justify-start hover:bg-primary/10"
                                :class="collapsed ? 'self-center' : ''"
                            />
                        </UTooltip>
                        <SettingsButton :collapsed="collapsed" />
                    </div>
                    <SpeechPlayer v-if="!collapsed" class="max-lg:hidden" />
                    <AccountCard v-if="!collapsed" />
                </div>
            </template>
        </UDashboardSidebar>

        <slot />
    </UDashboardGroup>
</template>
