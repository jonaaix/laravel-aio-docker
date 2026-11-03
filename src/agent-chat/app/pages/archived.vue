<script setup lang="ts">
import type { ConversationSummary } from '#shared/types/conversation';

const { t } = useI18n();
const { loadArchived, restore } = useConversations();

const archived = ref<ConversationSummary[]>([]);
const loading = ref(true);
const failed = ref(false);
const restoring = ref<string | null>(null);
const query = ref('');

function searchable(text: string): string {
    return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

const matches = computed(() => {
    const needle = searchable(query.value.trim());
    return needle ? archived.value.filter(conversation => searchable(conversation.title).includes(needle)) : archived.value;
});

async function load(): Promise<void> {
    loading.value = true;
    failed.value = false;
    try {
        archived.value = await loadArchived();
    }
    catch {
        failed.value = true;
    }
    finally {
        loading.value = false;
    }
}

async function restoreConversation(conversationId: string): Promise<void> {
    restoring.value = conversationId;
    try {
        await restore(conversationId);
        archived.value = archived.value.filter(conversation => conversation.id !== conversationId);
    }
    finally {
        restoring.value = null;
    }
}

onMounted(load);
</script>

<template>
    <UDashboardPanel id="archived-conversations">
        <template #header>
            <UDashboardNavbar :title="t('Archived Conversations')" />
        </template>

        <template #body>
            <UContainer class="py-4">
                <div v-if="loading" class="flex flex-col gap-2">
                    <USkeleton v-for="row in 4" :key="row" class="h-12 rounded-md" />
                </div>

                <UAlert
                    v-else-if="failed"
                    :title="t('Archived conversations could not be loaded')"
                    icon="i-heroicons-exclamation-triangle"
                    color="error"
                    variant="subtle"
                    :actions="[{ label: t('Retry'), color: 'neutral', variant: 'outline', onClick: load }]"
                />

                <div v-else-if="archived.length === 0" class="flex flex-col items-center gap-2 py-16 text-center text-muted">
                    <UIcon name="i-heroicons-archive-box" class="size-8" />
                    <p class="text-sm">{{ t('No archived conversations') }}</p>
                </div>

                <div v-else class="flex flex-col gap-3">
                    <UInput
                        v-model="query"
                        icon="i-heroicons-magnifying-glass"
                        :placeholder="t('Search archived conversations')"
                        :aria-label="t('Search archived conversations')"
                        class="w-full"
                    />

                    <div v-if="matches.length === 0" class="flex flex-col items-center gap-3 py-12 text-center text-muted">
                        <p class="text-sm">{{ t('No conversations match your search') }}</p>
                        <UButton :label="t('Clear search')" color="neutral" variant="outline" @click="query = ''" />
                    </div>

                    <ul v-else class="divide-y divide-default rounded-md ring ring-default">
                        <li v-for="conversation in matches" :key="conversation.id" class="flex items-center gap-3 px-4 py-2">
                            <ULink :to="`/c/${conversation.id}`" class="min-w-0 flex-1 truncate text-sm text-default hover:text-highlighted">
                                {{ conversation.title }}
                            </ULink>
                            <UButton
                                :label="t('Restore')"
                                icon="i-heroicons-arrow-uturn-left"
                                color="neutral"
                                variant="ghost"
                                :loading="restoring === conversation.id"
                                @click="restoreConversation(conversation.id)"
                            />
                        </li>
                    </ul>
                </div>
            </UContainer>
        </template>
    </UDashboardPanel>
</template>
