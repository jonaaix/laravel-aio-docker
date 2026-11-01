<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';
import type { ConversationListEvent } from '#shared/types/conversation';

const { conversations, upsert, load } = useConversations();
const { usage, load: loadAccount } = useAccount();
const { baseURL } = useRuntimeConfig().app;

const items = computed<NavigationMenuItem[][]>(() => groupByRecency(conversations.value).map(group => [
    { label: group.label, type: 'label' },
    ...group.conversations.map(conversation => ({
        label: conversation.title,
        to: `/c/${conversation.id}`,
        icon: conversation.turnActive ? 'i-heroicons-arrow-path' : undefined,
        ui: conversation.turnActive ? { linkLeadingIcon: 'animate-spin' } : undefined,
        online: conversation.status === 'running',
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
    });
    await Promise.all([load(), loadAccount()]);
});

onBeforeUnmount(() => unsubscribe?.());
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
                    :ui="{ link: 'overflow-hidden py-2', linkLabel: 'truncate' }"
                >
                    <template #item-trailing="{ item }">
                        <span v-if="item.online" class="size-2 rounded-full bg-success"><span class="sr-only">Online</span></span>
                    </template>
                </UNavigationMenu>
            </template>

            <template #footer="{ collapsed }">
                <div class="flex w-full flex-col gap-2">
                    <AccountCard v-if="!collapsed" />
                    <SettingsMenu :collapsed="collapsed" />
                </div>
            </template>
        </UDashboardSidebar>

        <slot />
    </UDashboardGroup>
</template>
