<script setup lang="ts">
import type { Agent } from '#shared/types/agent';
import type { ClaudeModel } from '#shared/types/model';
import type { UploadedFile } from '#shared/types/conversation';

const AVATAR_CHOICES = 8;


const { agents, managing, load, save, remove } = useAgents();
const { attachments, uploading, ready, add: attach, remove: removeAttachment, take: takeAttachments } = useAttachments();

const selectedId = ref<string | null>(null);
const creating = ref(false);
const name = ref('');
const role = ref('');
const model = ref('default');
const effort = ref<string>(DEFAULT_EFFORT);
const models = ref<ClaudeModel[]>([]);
const instructions = ref('');
const removedResources = ref<string[]>([]);
const saving = ref(false);
const error = ref<string | undefined>();
const confirmingDelete = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const avatarInput = ref<HTMLInputElement | null>(null);
const avatarSeed = ref<string | null>(null);
const avatarUpload = ref<UploadedFile | null>(null);
const avatarPreview = ref<string | null>(null);
const removeAvatar = ref(false);
const avatarBusy = ref(false);
const choosingAvatar = ref(false);
const avatarSeeds = ref<string[]>([]);

const selected = computed(() => creating.value ? null : agents.value.find(agent => agent.id === selectedId.value) ?? null);
const isLead = computed(() => selected.value?.lead ?? false);
const keptResources = computed(() => (selected.value?.resources ?? []).filter(resource => !removedResources.value.includes(resource.name)));
const modelItems = computed(() => {
    const items = models.value.map(entry => ({ label: entry.name, description: entry.description || undefined, value: entry.value }));
    return items.some(item => item.value === model.value) ? items : [...items, { label: model.value, description: undefined, value: model.value }];
});
const effortLevels = computed(() => models.value.find(entry => entry.value === model.value)?.effortLevels ?? []);
const effortItems = computed(() => effortLevels.value.map(level => ({
    label: level === 'xhigh' ? 'Extra high' : level.charAt(0).toUpperCase() + level.slice(1),
    value: level,
})));

watch(effortLevels, (levels) => {
    if (levels.length > 0 && !levels.includes(effort.value)) {
        effort.value = levels.includes(DEFAULT_EFFORT) ? DEFAULT_EFFORT : levels.at(-1)!;
    }
});

const valid = computed(() => normalizeUserName(name.value) !== null && !uploading.value && !avatarBusy.value);
const storedPicture = computed(() => removeAvatar.value ? null : selected.value?.avatarUrl ?? null);
const avatarParticipant = computed(() => ({ kind: 'agent' as const, name: name.value || 'agent', seed: avatarSeed.value, image: avatarPreview.value ?? storedPicture.value }));

function releasePreview(): void {
    if (avatarPreview.value) {
        URL.revokeObjectURL(avatarPreview.value);
    }
    avatarPreview.value = null;
}

function shuffleAvatars(): void {
    avatarSeeds.value = randomAvatarSeeds(AVATAR_CHOICES);
}

function chooseAvatar(seed: string): void {
    avatarSeed.value = seed;
    avatarUpload.value = null;
    releasePreview();
    removeAvatar.value = true;
    choosingAvatar.value = false;
}

function toggleAvatarChoice(): void {
    choosingAvatar.value = !choosingAvatar.value;
    if (choosingAvatar.value) {
        shuffleAvatars();
    }
}

async function onAvatarPicked(): Promise<void> {
    const file = avatarInput.value?.files?.[0];
    avatarInput.value!.value = '';
    if (!file) {
        return;
    }
    avatarBusy.value = true;
    try {
        avatarUpload.value = await apiFetch<UploadedFile>('uploads', {
            method: 'PUT',
            query: { name: file.name },
            body: file,
            headers: { 'content-type': 'application/octet-stream' },
        });
        releasePreview();
        avatarPreview.value = URL.createObjectURL(file);
        removeAvatar.value = false;
        choosingAvatar.value = false;
    }
    finally {
        avatarBusy.value = false;
    }
}

function clearPicture(): void {
    avatarUpload.value = null;
    releasePreview();
    removeAvatar.value = true;
}

function fill(agent: Agent | null): void {
    name.value = agent?.name ?? '';
    role.value = agent?.role ?? '';
    model.value = agent?.model ?? 'default';
    effort.value = agent?.effort ?? DEFAULT_EFFORT;
    instructions.value = agent?.instructions ?? '';
    removedResources.value = [];
    error.value = undefined;
    avatarSeed.value = agent?.avatarSeed ?? null;
    avatarUpload.value = null;
    releasePreview();
    removeAvatar.value = false;
    choosingAvatar.value = false;
    takeAttachments();
}

function select(agent: Agent): void {
    creating.value = false;
    selectedId.value = agent.id;
    fill(agent);
}

function startNew(): void {
    creating.value = true;
    selectedId.value = null;
    fill(null);
}

watch(managing, async (open) => {
    if (open) {
        const [, available] = await Promise.all([load(), apiFetch<ClaudeModel[]>('models')]);
        models.value = available;
        const first = agents.value[0];
        if (first) {
            select(first);
        }
    }
});

function pickFiles(): void {
    fileInput.value?.click();
}

function onPicked(): void {
    attach([...(fileInput.value?.files ?? [])]);
    fileInput.value!.value = '';
}

async function submit(): Promise<void> {
    if (!valid.value || saving.value) {
        return;
    }
    saving.value = true;
    error.value = undefined;
    try {
        const saved = await save(selected.value?.id ?? null, {
            name: name.value,
            role: role.value,
            model: model.value === 'default' ? null : model.value,
            effort: effortLevels.value.length > 0 ? effort.value : null,
            instructions: instructions.value,
            uploads: ready.value.map(upload => ({ id: upload.id, filename: upload.filename })),
            removedResources: removedResources.value,
            avatarSeed: avatarSeed.value,
            avatarUpload: avatarUpload.value ? { id: avatarUpload.value.id, filename: avatarUpload.value.filename } : null,
            removeAvatar: removeAvatar.value,
        });
        select(agents.value.find(agent => agent.id === saved.id) ?? saved);
    }
    catch (failure) {
        error.value = (failure as { statusMessage?: string }).statusMessage ?? 'Could not save the agent';
    }
    finally {
        saving.value = false;
    }
}

async function confirmDelete(): Promise<void> {
    const agent = selected.value;
    confirmingDelete.value = false;
    if (!agent) {
        return;
    }
    await remove(agent.id);
    const first = agents.value[0];
    if (first) {
        select(first);
    }
}
</script>

<template>
    <UModal v-model:open="managing" title="Agents" :ui="{ content: 'sm:max-w-4xl', footer: 'justify-between' }">
        <template #body>
            <div class="flex flex-col gap-5 sm:flex-row">
                <nav class="flex shrink-0 flex-col gap-1 sm:w-64">
                    <button
                        v-for="agent in agents"
                        :key="agent.id"
                        type="button"
                        class="flex min-h-12 items-center gap-2.5 rounded-md px-2 py-1.5 text-start transition-colors duration-500 ease-out hover:bg-elevated"
                        :class="!creating && agent.id === selectedId ? 'bg-elevated' : ''"
                        @click="select(agent)"
                    >
                        <ParticipantAvatar :participant="{ kind: 'agent', name: agent.name, seed: agent.avatarSeed, image: agent.avatarUrl }" class="size-10" />
                        <span class="min-w-0">
                            <span class="block truncate text-sm font-medium text-highlighted">{{ agent.name }}</span>
                            <span class="line-clamp-2 text-xs text-muted">{{ agent.role || 'No role' }}</span>
                        </span>
                    </button>
                    <UButton label="New agent" icon="i-heroicons-plus" color="neutral" variant="ghost" class="justify-start" :class="creating ? 'bg-elevated' : ''" @click="startNew" />
                </nav>

                <form id="agent-form" class="flex min-w-0 flex-1 flex-col gap-4" @submit.prevent="submit">
                    <div class="flex flex-col gap-3">
                        <div class="flex items-center gap-4">
                            <ParticipantAvatar :participant="avatarParticipant" class="size-16" />
                            <div class="flex flex-wrap gap-2">
                                <UButton label="Choose bot" icon="i-heroicons-sparkles" color="neutral" variant="outline" @click="toggleAvatarChoice" />
                                <UButton label="Upload picture" icon="i-heroicons-arrow-up-tray" color="neutral" variant="outline" :loading="avatarBusy" @click="avatarInput?.click()" />
                                <UButton v-if="avatarPreview || storedPicture" label="Remove picture" color="neutral" variant="ghost" @click="clearPicture" />
                            </div>
                            <input ref="avatarInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" @change="onAvatarPicked">
                        </div>
                        <div v-if="choosingAvatar" class="flex flex-wrap items-center gap-2 rounded-md p-2 ring ring-default">
                            <button
                                v-for="seed in avatarSeeds"
                                :key="seed"
                                type="button"
                                class="rounded-md p-1 transition-colors duration-500 ease-out hover:bg-elevated"
                                :aria-label="`Use bot ${seed}`"
                                @click="chooseAvatar(seed)"
                            >
                                <ParticipantAvatar :participant="{ kind: 'agent', name: seed, seed }" class="size-12" />
                            </button>
                            <UTooltip text="Shuffle">
                                <UButton icon="i-heroicons-arrow-path" aria-label="Shuffle" color="neutral" variant="ghost" @click="shuffleAvatars" />
                            </UTooltip>
                        </div>
                    </div>
                    <UFormField label="Name" :error="error">
                        <UInput v-model="name" :maxlength="USER_NAME_MAX_LENGTH" class="w-full" />
                    </UFormField>
                    <UFormField label="Role">
                        <UInput v-model="role" :maxlength="AGENT_ROLE_MAX_LENGTH" class="w-full" />
                    </UFormField>
                    <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_13rem]">
                        <UFormField label="Model">
                            <USelect v-model="model" :items="modelItems" class="w-full" :ui="{ content: 'min-w-72' }" />
                        </UFormField>
                        <UFormField v-if="effortLevels.length > 0" label="Effort">
                            <USelect v-model="effort" :items="effortItems" class="w-full" />
                        </UFormField>
                    </div>
                    <template v-if="!isLead">
                        <UFormField label="Instructions" hint="CLAUDE.md">
                            <UTextarea v-model="instructions" :rows="8" autoresize :maxrows="16" class="w-full font-mono text-sm" />
                        </UFormField>
                        <UFormField label="Resources">
                            <div class="flex flex-col gap-2">
                                <ul v-if="keptResources.length > 0" class="divide-y divide-default rounded-md ring ring-default">
                                    <li v-for="resource in keptResources" :key="resource.name" class="flex h-9 items-center gap-2 ps-3 pe-1 text-sm">
                                        <UIcon name="i-heroicons-document" class="size-4 shrink-0 text-muted" />
                                        <span class="min-w-0 flex-1 truncate">{{ resource.name }}</span>
                                        <span class="shrink-0 text-xs text-muted tabular-nums">{{ formatBytes(resource.size) }}</span>
                                        <UTooltip text="Remove">
                                            <UButton icon="i-heroicons-x-mark" aria-label="Remove" color="neutral" variant="ghost" size="sm" @click="removedResources.push(resource.name)" />
                                        </UTooltip>
                                    </li>
                                </ul>
                                <ChatAttachmentChips v-if="attachments.length > 0" :attachments="attachments" @remove="removeAttachment" />
                                <UButton label="Add files" icon="i-heroicons-paper-clip" color="neutral" variant="outline" class="self-start" @click="pickFiles" />
                                <input ref="fileInput" type="file" multiple class="hidden" @change="onPicked">
                            </div>
                        </UFormField>
                    </template>
                </form>
            </div>
        </template>
        <template #footer>
            <UButton
                v-if="selected && !isLead"
                label="Delete"
                icon="i-heroicons-trash"
                color="error"
                variant="ghost"
                @click="confirmingDelete = true"
            />
            <span v-else />
            <div class="flex gap-2">
                <UButton label="Close" color="neutral" variant="outline" @click="managing = false" />
                <UButton type="submit" form="agent-form" :label="creating ? 'Create' : 'Save'" :loading="saving" :disabled="!valid" />
            </div>
        </template>
    </UModal>

    <UModal v-model:open="confirmingDelete" title="Delete agent" :ui="{ footer: 'justify-end' }">
        <template #body>
            <p class="text-sm">{{ selected?.name }} and its files will be deleted.</p>
        </template>
        <template #footer>
            <UButton label="Cancel" color="neutral" variant="outline" @click="confirmingDelete = false" />
            <UButton label="Delete" color="error" @click="confirmDelete" />
        </template>
    </UModal>
</template>
