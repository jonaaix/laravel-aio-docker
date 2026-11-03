<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

defineProps<{ collapsed?: boolean }>();

const { t } = useI18n();
const { unreadByServer } = useHubUnread();

const adding = ref(false);
const removing = ref(false);
const removeBusy = ref(false);

const otherUnread = computed(() => hubServers.value
    .filter(server => server.id !== activeServerId.value)
    .reduce((sum, server) => sum + (unreadByServer.value[server.id] ?? 0), 0));

type ServerItem = DropdownMenuItem & { unread?: number };

function unreadOf(item: ServerItem): number {
    return item.unread ?? 0;
}

const items = computed<ServerItem[][]>(() => [
    hubServers.value.map(server => ({
        label: server.label,
        icon: server.id === activeServerId.value ? 'i-heroicons-check' : 'i-heroicons-server-stack',
        slot: 'server' as const,
        unread: unreadByServer.value[server.id] ?? 0,
        onSelect: () => server.id !== activeServerId.value && switchServer(server.id),
    })),
    [
        { label: t('Add server'), icon: 'i-heroicons-plus', onSelect: () => (adding.value = true) },
        { label: t('Remove this server'), icon: 'i-heroicons-trash', onSelect: () => (removing.value = true) },
    ],
]);

async function confirmRemove(): Promise<void> {
    if (!activeServer.value) {
        return;
    }
    removeBusy.value = true;
    await apiFetch(`devices/${activeServer.value.deviceId}`, { method: 'DELETE' }).catch(() => undefined);
    await forgetServer(activeServer.value.id);
    await loadHubServers();
    switchServer(activeServerId.value ?? '');
}
</script>

<template>
    <UDropdownMenu :items="items" :content="{ align: 'start' }" :ui="{ content: 'min-w-64' }">
        <UButton
            color="neutral"
            variant="ghost"
            block
            :square="collapsed"
            :aria-label="t('Servers')"
            class="justify-start"
        >
            <UIcon name="i-heroicons-server-stack" class="size-5 shrink-0" />
            <span v-if="!collapsed" class="min-w-0 flex-1 truncate text-start">{{ activeServer?.label }}</span>
            <span v-if="otherUnread > 0" class="rounded-full bg-primary px-1.5 text-[0.6875rem]/4 font-medium text-inverted tabular-nums">{{ otherUnread > 99 ? '99+' : otherUnread }}</span>
            <UIcon v-if="!collapsed" name="i-heroicons-chevron-up-down" class="size-4 shrink-0 text-muted" />
        </UButton>
        <template #server-trailing="{ item }">
            <span v-if="unreadOf(item) > 0" class="rounded-full bg-primary px-1.5 text-[0.6875rem]/4 font-medium text-inverted tabular-nums">{{ unreadOf(item) > 99 ? '99+' : unreadOf(item) }}</span>
        </template>
    </UDropdownMenu>
    <UModal v-model:open="adding" :title="t('Add server')">
        <template #body>
            <HubConnectForm cancellable @cancel="adding = false" />
        </template>
    </UModal>
    <UModal v-model:open="removing" :title="t('Remove this server')" :ui="{ footer: 'justify-end' }">
        <template #body>
            <p class="text-sm">{{ t('{server} is removed from this device.', { server: activeServer?.label ?? '' }) }}</p>
        </template>
        <template #footer>
            <UButton :label="t('Cancel')" color="neutral" variant="outline" @click="removing = false" />
            <UButton :label="t('Remove')" color="error" :loading="removeBusy" @click="confirmRemove" />
        </template>
    </UModal>
</template>
