<script setup lang="ts">
import type { ChatUser } from '#shared/types/user';

type PersonSetting = 'admin' | 'account-details' | 'blocked';

const { t } = useI18n();
const { users, upsert } = useUsers();
const { user: me } = useUserName();
const { detailsHidden } = useAccount();

const pending = ref<{ id: string; setting: PersonSetting; value: boolean } | null>(null);
const error = ref<string | undefined>();

const people = computed(() => Object.values(users.value).sort((a, b) => a.name.localeCompare(b.name)));

const columns = computed<{ setting: PersonSetting; label: string }[]>(() => [
    { setting: 'admin', label: t('Admin') },
    { setting: 'account-details', label: t('AI account details') },
    { setting: 'blocked', label: t('Blocked') },
]);

function failureMessage(failure: unknown): string {
    const data = failure as { data?: { statusMessage?: string }; statusMessage?: string };
    return data.data?.statusMessage ?? data.statusMessage ?? t('Could not change this person');
}

function seesAccountDetails(person: ChatUser): boolean {
    return person.accountDetails ? person.accountDetails === 'shown' : person.admin || !detailsHidden.value;
}

function storedValue(person: ChatUser, setting: PersonSetting): boolean {
    if (setting === 'admin') {
        return person.admin;
    }
    if (setting === 'blocked') {
        return person.blocked;
    }
    return seesAccountDetails(person);
}

function checked(person: ChatUser, setting: PersonSetting): boolean {
    const change = pending.value;
    return change?.id === person.id && change.setting === setting ? change.value : storedValue(person, setting);
}

function locked(person: ChatUser, setting: PersonSetting): boolean {
    if (pending.value?.id === person.id) {
        return true;
    }
    if (setting === 'blocked') {
        return person.id === me.value?.id;
    }
    return person.blocked;
}

function requestBody(setting: PersonSetting, value: boolean): Record<string, boolean> {
    if (setting === 'admin') {
        return { admin: value };
    }
    if (setting === 'blocked') {
        return { blocked: value };
    }
    return { shown: value };
}

async function change(person: ChatUser, setting: PersonSetting, value: boolean | 'indeterminate'): Promise<void> {
    const enabled = value === true;
    pending.value = { id: person.id, setting, value: enabled };
    error.value = undefined;
    try {
        const updated = await apiFetch<ChatUser>(`users/${person.id}/${setting}`, { method: 'PUT', body: requestBody(setting, enabled) });
        upsert(updated);
        if (updated.id === me.value?.id) {
            me.value = updated;
        }
    }
    catch (failure) {
        error.value = failureMessage(failure);
    }
    finally {
        pending.value = null;
    }
}
</script>

<template>
    <div class="flex max-w-2xl flex-col gap-4">
        <div class="overflow-x-auto rounded-md ring ring-default">
            <table class="people-table w-full text-sm">
                <thead>
                    <tr>
                        <th class="text-start">{{ t('Person') }}</th>
                        <th v-for="column in columns" :key="column.setting">{{ column.label }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="person in people" :key="person.id">
                        <td>
                            <div class="flex items-center gap-3">
                                <ParticipantAvatar
                                    :participant="{ kind: 'person', name: person.name, seed: person.avatarSeed, image: person.avatarUrl }"
                                    class="size-8"
                                    :class="{ 'opacity-50': person.blocked }"
                                />
                                <span class="font-medium whitespace-nowrap" :class="person.blocked ? 'text-muted' : 'text-highlighted'">{{ person.name }}</span>
                                <span v-if="person.id === me?.id" class="text-xs text-muted">{{ t('You') }}</span>
                            </div>
                        </td>
                        <td v-for="column in columns" :key="column.setting">
                            <div class="flex justify-center">
                                <UCheckbox
                                    :model-value="checked(person, column.setting)"
                                    :disabled="locked(person, column.setting)"
                                    :color="column.setting === 'blocked' ? 'error' : 'primary'"
                                    :aria-label="t('{option} for {name}', { option: column.label, name: person.name })"
                                    @update:model-value="change(person, column.setting, $event)"
                                />
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <p v-if="error" class="text-sm text-error">{{ error }}</p>
    </div>
</template>

<style scoped>
.people-table :where(th) {
    height: 2.25rem;
    padding-inline: 0.75rem;
    border-bottom: 1px solid var(--ui-border);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--ui-text-muted);
    white-space: nowrap;
}

.people-table :where(td) {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--ui-border);
}

.people-table :where(tbody tr:last-child td) {
    border-bottom: 0;
}
</style>
