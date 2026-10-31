<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';

const { conversations, load, subscribe } = useConversations();
const { baseURL } = useRuntimeConfig().app;

const items = computed<NavigationMenuItem[]>(() => conversations.value.map(conversation => ({
  label: conversation.title,
  to: `/c/${conversation.id}`,
  icon: conversation.turnActive ? 'i-heroicons-arrow-path' : undefined,
  ui: conversation.turnActive ? { linkLeadingIcon: 'animate-spin' } : undefined,
})));

let unsubscribe: (() => void) | undefined;

onMounted(async () => {
  unsubscribe = subscribe();
  await load();
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
      :ui="{ footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed }">
        <UTooltip text="New conversation" :disabled="!collapsed">
          <UButton
            to="/"
            icon="i-heroicons-pencil-square"
            :label="collapsed ? undefined : 'New conversation'"
            aria-label="New conversation"
            color="neutral"
            variant="soft"
            block
            :square="collapsed"
          />
        </UTooltip>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :items="items"
          :collapsed="collapsed"
          orientation="vertical"
          :ui="{ link: 'overflow-hidden', linkLabel: 'truncate' }"
        />
      </template>

      <template #footer="{ collapsed }">
        <UColorModeButton :class="collapsed ? '' : 'ms-auto'" />
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
