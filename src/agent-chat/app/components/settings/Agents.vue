<script setup lang="ts">
import type { Agent } from '#shared/types/agent';
import type { ClaudeModel } from '#shared/types/model';
import type { UploadedFile } from '#shared/types/conversation';

defineProps<{ actionsTarget: string }>();

const SAVE_DELAY_MS = 700;

const { t } = useI18n();

const { agents, load, save, remove } = useAgents();
const { attachments, uploading, ready, add: attach, remove: removeAttachment, take: takeAttachments } = useAttachments();

const selectedId = ref<string | null>(null);
const choiceKey = ref(0);
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

const selected = computed(() => creating.value ? null : agents.value.find(agent => agent.id === selectedId.value) ?? null);
const isLead = computed(() => selected.value?.lead ?? false);
const keptResources = computed(() => (selected.value?.resources ?? []).filter(resource => !removedResources.value.includes(resource.name)));
const modelItems = computed(() => {
    const items = models.value.map(entry => ({ label: entry.name, description: entry.description || undefined, value: entry.value }));
    return items.some(item => item.value === model.value) ? items : [...items, { label: model.value, description: undefined, value: model.value }];
});
const effortLevels = computed(() => models.value.find(entry => entry.value === model.value)?.effortLevels ?? []);
const effortItems = computed(() => effortLevels.value.map((level) => {
    const name = level === 'xhigh' ? t('Extra high') : level.charAt(0).toUpperCase() + level.slice(1);
    return { label: level === DEFAULT_EFFORT ? t('{name} (default)', { name }) : name, value: level };
}));

watch(effortLevels, (levels) => {
    if (levels.length > 0 && !levels.includes(effort.value)) {
        effort.value = levels.includes(DEFAULT_EFFORT) ? DEFAULT_EFFORT : levels.at(-1)!;
    }
});

const roleTouched = ref(false);
const roleMissing = computed(() => normalizeUserName(name.value) !== null && !role.value.trim());
const valid = computed(() => normalizeUserName(name.value) !== null && !roleMissing.value && !uploading.value && !avatarBusy.value);
const fieldsKey = computed(() => JSON.stringify([name.value, role.value, model.value, effort.value, instructions.value]));
let savedKey = '';
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saveAgain = false;
const storedPicture = computed(() => removeAvatar.value ? null : selected.value?.avatarUrl ?? null);
const avatarParticipant = computed(() => ({ kind: 'agent' as const, name: name.value || 'agent', seed: avatarSeed.value, image: avatarPreview.value ?? storedPicture.value }));

function releasePreview(): void {
    if (avatarPreview.value) {
        URL.revokeObjectURL(avatarPreview.value);
    }
    avatarPreview.value = null;
}

function chooseAvatar(seed: string): void {
    avatarSeed.value = seed;
    avatarUpload.value = null;
    releasePreview();
    removeAvatar.value = true;
    void persist();
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
    }
    finally {
        avatarBusy.value = false;
    }
    void persist();
}

function clearPicture(): void {
    avatarUpload.value = null;
    releasePreview();
    removeAvatar.value = true;
    void persist();
}

function removeResource(resourceName: string): void {
    removedResources.value.push(resourceName);
    void persist();
}

function fill(agent: Agent | null): void {
    name.value = agent?.name ?? '';
    role.value = agent?.role ?? '';
    model.value = agent?.model ?? 'default';
    effort.value = agent?.effort ?? DEFAULT_EFFORT;
    instructions.value = agent?.instructions ?? '';
    removedResources.value = [];
    error.value = undefined;
    roleTouched.value = false;
    avatarSeed.value = agent?.avatarSeed ?? null;
    avatarUpload.value = null;
    releasePreview();
    removeAvatar.value = false;
    takeAttachments();
    savedKey = fieldsKey.value;
}

async function flushPending(): Promise<void> {
    if (fieldsKey.value !== savedKey) {
        await persist();
    }
}

async function select(agent: Agent): Promise<void> {
    await flushPending();
    creating.value = false;
    selectedId.value = agent.id;
    choiceKey.value += 1;
    fill(agent);
}

async function startNew(): Promise<void> {
    await flushPending();
    creating.value = true;
    selectedId.value = null;
    choiceKey.value += 1;
    fill(null);
}

onMounted(async () => {
    const modelsLoaded = apiFetch<ClaudeModel[]>('models').then((available) => {
        models.value = available;
    });
    await load();
    const first = agents.value[0];
    if (first) {
        await select(first);
    }
    await modelsLoaded;
});

function pickFiles(): void {
    fileInput.value?.click();
}

function onPicked(): void {
    attach([...(fileInput.value?.files ?? [])]);
    fileInput.value!.value = '';
}

async function persist(): Promise<void> {
    clearTimeout(saveTimer);
    if (!valid.value) {
        return;
    }
    if (saving.value) {
        saveAgain = true;
        return;
    }
    const key = fieldsKey.value;
    const sentUploads = ready.value.length > 0;
    saving.value = true;
    error.value = undefined;
    try {
        const saved = await save(creating.value ? null : selectedId.value, {
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
        creating.value = false;
        selectedId.value = saved.id;
        savedKey = key;
        removedResources.value = [];
        avatarUpload.value = null;
        removeAvatar.value = false;
        releasePreview();
        if (sentUploads) {
            takeAttachments();
        }
    }
    catch (failure) {
        error.value = (failure as { statusMessage?: string }).statusMessage ?? t('Could not save the agent');
    }
    finally {
        saving.value = false;
    }
    if (saveAgain) {
        saveAgain = false;
        void persist();
    }
}

watch(fieldsKey, (key) => {
    clearTimeout(saveTimer);
    if (key !== savedKey) {
        saveTimer = setTimeout(() => void persist(), SAVE_DELAY_MS);
    }
});

watch(() => ready.value.length, (count) => {
    if (count > 0) {
        void persist();
    }
});

onBeforeUnmount(() => {
    void flushPending();
});

async function confirmDelete(): Promise<void> {
    const agent = selected.value;
    clearTimeout(saveTimer);
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
    <div class="flex flex-col gap-5 sm:flex-row">
        <nav class="flex shrink-0 flex-col gap-1 sm:w-56">
            <button
                v-for="agent in agents"
                :key="agent.id"
                type="button"
                class="flex min-h-12 items-center gap-2.5 rounded-md px-2 py-1.5 text-start transition-colors duration-500 ease-out hover:bg-elevated"
                :class="!creating && agent.id === selectedId ? 'bg-elevated' : ''"
                @click="select(agent)"
            >
                <span class="flex size-10 shrink-0 items-center justify-center">
                    <ParticipantAvatar :participant="{ kind: 'agent', name: agent.name, seed: agent.avatarSeed, image: agent.avatarUrl }" :class="isVoxelBot({ kind: 'agent', name: agent.name, seed: agent.avatarSeed, image: agent.avatarUrl }) ? 'size-10' : 'size-8'" />
                </span>
                <span class="min-w-0">
                    <span class="block truncate text-sm font-medium text-highlighted">{{ agent.name }}</span>
                    <span class="line-clamp-2 text-xs text-muted">{{ agent.role }}</span>
                </span>
            </button>
            <div v-if="creating" class="flex min-h-12 items-center gap-2.5 rounded-md bg-elevated px-2 py-1.5">
                <span class="flex size-10 shrink-0 items-center justify-center">
                    <ParticipantAvatar :participant="avatarParticipant" :class="isVoxelBot(avatarParticipant) ? 'size-10' : 'size-8'" />
                </span>
                <span class="min-w-0">
                    <span class="block truncate text-sm font-medium text-highlighted">{{ name.trim() || t('New agent') }}</span>
                    <span class="line-clamp-2 text-xs text-muted">{{ role }}</span>
                </span>
            </div>
            <UButton :label="t('New agent')" icon="i-heroicons-plus" color="neutral" variant="ghost" class="justify-start" @click="startNew" />
        </nav>

        <form v-if="selected || creating" id="agent-form" class="flex min-w-0 flex-1 flex-col gap-3.5" @submit.prevent="roleTouched = true; persist()">
            <div class="grid gap-3.5 sm:grid-cols-2">
                <UFormField :label="t('Name')" required :error="error">
                    <UInput v-model="name" :maxlength="USER_NAME_MAX_LENGTH" class="w-full" />
                </UFormField>
                <UFormField :label="t('Role')" required :error="roleMissing && roleTouched ? t('Required') : undefined">
                    <UInput v-model="role" :maxlength="AGENT_ROLE_MAX_LENGTH" class="w-full" @blur="roleTouched = true" />
                </UFormField>
            </div>
            <div class="flex flex-col gap-3 sm:flex-row">
                <div class="flex shrink-0 items-center gap-3 sm:w-28 sm:flex-col sm:justify-between sm:gap-2">
                    <span class="flex size-20 shrink-0 items-center justify-center">
                        <ParticipantAvatar :participant="avatarParticipant" :class="isVoxelBot(avatarParticipant) ? 'size-20' : 'size-16'" />
                    </span>
                    <div class="flex gap-2 sm:w-full sm:flex-col">
                        <UButton :label="t('Upload')" icon="i-heroicons-arrow-up-tray" color="neutral" variant="outline" class="sm:w-full sm:justify-center" :loading="avatarBusy" @click="avatarInput?.click()" />
                        <UButton v-if="avatarPreview || storedPicture" :label="t('Remove')" color="neutral" variant="ghost" class="sm:w-full sm:justify-center" @click="clearPicture" />
                    </div>
                    <input ref="avatarInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" @change="onAvatarPicked">
                </div>
                <AvatarChoice
                    :key="choiceKey"
                    kind="agent"
                    :current="avatarPreview || storedPicture ? null : avatarSeed"
                    :presets="AGENT_PRESET_ROWS"
                    size="sm"
                    class="min-w-0 flex-1"
                    @select="chooseAvatar"
                />
            </div>
            <div class="grid gap-3.5 sm:grid-cols-[minmax(0,1fr)_13rem]">
                <UFormField :label="t('Model')">
                    <USelect v-model="model" :items="modelItems" class="w-full" :ui="{ content: 'min-w-72' }" />
                </UFormField>
                <UFormField v-if="effortLevels.length > 0" :label="t('Effort')">
                    <USelect v-model="effort" :items="effortItems" class="w-full" />
                </UFormField>
            </div>
            <UFormField v-if="isLead" :label="t('Instructions')">
                <p class="flex items-center gap-2 rounded-md bg-elevated/60 px-3 py-2 text-sm text-toned">
                    <UIcon name="i-heroicons-information-circle" class="size-4 shrink-0 text-muted" />
                    {{ t('Uses the CLAUDE.md of the project it works in.') }}
                </p>
            </UFormField>
            <template v-else>
                <UFormField :label="t('Instructions')" hint="CLAUDE.md">
                    <UTextarea v-model="instructions" :rows="4" autoresize :maxrows="8" class="w-full font-mono text-sm" />
                </UFormField>
                <UFormField :label="t('Resources')">
                    <div class="flex flex-col gap-2">
                        <ul v-if="keptResources.length > 0" class="divide-y divide-default rounded-md ring ring-default">
                            <li v-for="resource in keptResources" :key="resource.name" class="flex h-9 items-center gap-2 ps-3 pe-1 text-sm">
                                <UIcon name="i-heroicons-document" class="size-4 shrink-0 text-muted" />
                                <span class="min-w-0 flex-1 truncate">{{ resource.name }}</span>
                                <span class="shrink-0 text-xs text-muted tabular-nums">{{ formatBytes(resource.size) }}</span>
                                <UTooltip :text="t('Remove')">
                                    <UButton icon="i-heroicons-x-mark" :aria-label="t('Remove')" color="neutral" variant="ghost" size="sm" @click="removeResource(resource.name)" />
                                </UTooltip>
                            </li>
                        </ul>
                        <ChatAttachmentChips v-if="attachments.length > 0" :attachments="attachments" @remove="removeAttachment" />
                        <UButton :label="t('Add files')" icon="i-heroicons-paper-clip" color="neutral" variant="outline" class="self-start" @click="pickFiles" />
                        <input ref="fileInput" type="file" multiple class="hidden" @change="onPicked">
                    </div>
                </UFormField>
            </template>
        </form>
        <div v-else class="flex min-w-0 flex-1 flex-col gap-4">
            <USkeleton class="h-14 w-full rounded-md" />
            <USkeleton class="h-14 w-full rounded-md" />
            <USkeleton class="h-40 w-full rounded-md" />
        </div>
    </div>
    <Teleport defer :to="actionsTarget">
        <UButton
            v-if="selected && !isLead"
            :label="t('Delete')"
            icon="i-heroicons-trash"
            color="error"
            variant="ghost"
            @click="confirmingDelete = true"
        />
        <span v-else />
        <span class="text-sm text-muted">{{ saving ? t('Saving…') : '' }}</span>
    </Teleport>

    <UModal v-model:open="confirmingDelete" :title="t('Delete agent')" :ui="{ footer: 'justify-end' }">
        <template #body>
            <p class="text-sm">{{ t('{name} and its files will be deleted.', { name: selected?.name }) }}</p>
        </template>
        <template #footer>
            <UButton :label="t('Cancel')" color="neutral" variant="outline" @click="confirmingDelete = false" />
            <UButton :label="t('Delete')" color="error" @click="confirmDelete" />
        </template>
    </UModal>
</template>
