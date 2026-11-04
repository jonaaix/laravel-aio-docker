<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import type { ChatUser } from '#shared/types/user';

const { t } = useI18n();
const { users, upsert } = useUsers();
const { user: me } = useUserName();

const busyId = ref<string | null>(null);
const error = ref<string | undefined>();

const people = computed(() => Object.values(users.value).sort((a, b) => a.name.localeCompare(b.name)));

function failureMessage(failure: unknown): string {
    const data = failure as { data?: { statusMessage?: string }; statusMessage?: string };
    return data.data?.statusMessage ?? data.statusMessage ?? t('Could not change this person');
}

async function change(person: ChatUser, setting: 'admin' | 'blocked', value: boolean): Promise<void> {
    busyId.value = person.id;
    error.value = undefined;
    try {
        const updated = await apiFetch<ChatUser>(`users/${person.id}/${setting}`, { method: 'PUT', body: { [setting]: value } });
        upsert(updated);
        if (updated.id === me.value?.id) {
            me.value = updated;
        }
    }
    catch (failure) {
        error.value = failureMessage(failure);
    }
    finally {
        busyId.value = null;
    }
}

function actions(person: ChatUser): DropdownMenuItem[] {
    const items: DropdownMenuItem[] = [];
    if (person.admin) {
        items.push({ label: t('Remove admin'), icon: 'i-heroicons-shield-exclamation', onSelect: () => change(person, 'admin', false) });
    }
    else if (!person.blocked) {
        items.push({ label: t('Make admin'), icon: 'i-heroicons-shield-check', onSelect: () => change(person, 'admin', true) });
    }
    if (person.id !== me.value?.id) {
        items.push(person.blocked
            ? { label: t('Unblock'), icon: 'i-heroicons-lock-open', onSelect: () => change(person, 'blocked', false) }
            : { label: t('Block'), icon: 'i-heroicons-no-symbol', color: 'error', onSelect: () => change(person, 'blocked', true) });
    }
    return items;
}
</script>

<template>
    <div class="flex max-w-xl flex-col gap-4">
        <ul class="divide-y divide-default rounded-md ring ring-default">
            <li v-for="person in people" :key="person.id" class="flex items-center gap-3 px-3 py-2.5">
                <ParticipantAvatar :participant="{ kind: 'person', name: person.name, seed: person.avatarSeed, image: person.avatarUrl }" class="size-8" :class="{ 'opacity-50': person.blocked }" />
                <div class="flex min-w-0 flex-1 items-center gap-2">
                    <span class="truncate text-sm font-medium" :class="person.blocked ? 'text-muted' : 'text-highlighted'">{{ person.name }}</span>
                    <span v-if="person.id === me?.id" class="text-xs text-muted">{{ t('You') }}</span>
                    <UBadge v-if="person.admin" :label="t('Admin')" color="primary" variant="subtle" size="sm" />
                    <UBadge v-if="person.blocked" :label="t('Blocked')" color="error" variant="subtle" size="sm" />
                </div>
                <UDropdownMenu :items="actions(person)" :content="{ align: 'end' }">
                    <UTooltip :text="t('Actions for {name}', { name: person.name })">
                        <UButton
                            icon="i-heroicons-ellipsis-horizontal"
                            color="neutral"
                            variant="ghost"
                            :loading="busyId === person.id"
                            :aria-label="t('Actions for {name}', { name: person.name })"
                        />
                    </UTooltip>
                </UDropdownMenu>
            </li>
        </ul>
        <p v-if="error" class="text-sm text-error">{{ error }}</p>
    </div>
</template>
