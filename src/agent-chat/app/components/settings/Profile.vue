<script setup lang="ts">
import type { UploadedFile } from '#shared/types/conversation';

const props = defineProps<{ actionsTarget?: string }>();
const emit = defineEmits<{ saved: [] }>();

const SAVE_DELAY_MS = 700;

const { user, name, locked, save, setAvatar, setAvatarSeed } = useUserName();

const draft = ref(name.value ?? '');
const saving = ref(false);
const pictureBusy = ref(false);
const error = ref<string | undefined>();
const pictureError = ref<string | undefined>();
const fileInput = ref<HTMLInputElement | null>(null);
const required = computed(() => !name.value);
const changed = computed(() => normalizeUserName(draft.value) !== null && normalizeUserName(draft.value) !== name.value);

function failureMessage(failure: unknown, fallback: string): string {
    const data = (failure as { data?: { statusMessage?: string }; statusMessage?: string });
    return data.data?.statusMessage ?? data.statusMessage ?? fallback;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

async function submit(): Promise<void> {
    clearTimeout(saveTimer);
    if (locked.value || !changed.value || saving.value) {
        return;
    }
    saving.value = true;
    error.value = undefined;
    try {
        await save(draft.value);
        emit('saved');
    }
    catch (failure) {
        error.value = failureMessage(failure, 'Could not save the name');
    }
    finally {
        saving.value = false;
    }
}

async function changePicture(upload: Promise<UploadedFile | null | undefined>): Promise<void> {
    pictureBusy.value = true;
    pictureError.value = undefined;
    try {
        const picked = await upload;
        if (picked !== undefined) {
            await setAvatar(picked);
        }
    }
    catch (failure) {
        pictureError.value = failureMessage(failure, 'Could not change the picture');
    }
    finally {
        pictureBusy.value = false;
    }
}

watch(draft, () => {
    clearTimeout(saveTimer);
    if (!props.actionsTarget) {
        saveTimer = setTimeout(() => void submit(), SAVE_DELAY_MS);
    }
});

onBeforeUnmount(() => {
    if (!props.actionsTarget) {
        void submit();
    }
});

function pickAvatar(seed: string): void {
    void changePicture(setAvatarSeed(seed).then(() => undefined));
}

function removePicture(): void {
    void changePicture(Promise.resolve(null));
}

function onPicked(): void {
    const file = fileInput.value?.files?.[0];
    fileInput.value!.value = '';
    if (file) {
        void changePicture(apiFetch<UploadedFile>('uploads', {
            method: 'PUT',
            query: { name: file.name },
            body: file,
            headers: { 'content-type': 'application/octet-stream' },
        }));
    }
}
</script>

<template>
    <form id="profile-form" class="flex flex-col gap-4" @submit.prevent="submit">
        <UFormField :label="required ? undefined : 'Name'" :error="error">
            <UInput
                v-model="draft"
                :maxlength="USER_NAME_MAX_LENGTH"
                :disabled="locked"
                placeholder="Name"
                aria-label="Your name"
                autofocus
                class="w-full"
            />
        </UFormField>
        <div v-if="user" class="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div class="flex shrink-0 items-center gap-3 sm:w-28 sm:flex-col">
                <ParticipantAvatar :participant="{ kind: 'person', name: user.name, seed: user.avatarSeed, image: user.avatarUrl }" class="size-20" />
                <div v-if="!user.avatarLocked" class="flex gap-2 sm:w-full sm:flex-col">
                    <UButton label="Upload" icon="i-heroicons-arrow-up-tray" color="neutral" variant="outline" class="sm:w-full sm:justify-center" :loading="pictureBusy" @click="fileInput?.click()" />
                    <UButton v-if="user.avatarUrl" label="Remove" color="neutral" variant="ghost" class="sm:w-full sm:justify-center" :disabled="pictureBusy" @click="removePicture" />
                </div>
                <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" @change="onPicked">
            </div>
            <AvatarChoice
                v-if="!user.avatarLocked"
                kind="person"
                :current="user.avatarUrl ? null : user.avatarSeed"
                class="min-w-0 flex-1"
                @select="pickAvatar"
            />
        </div>
        <p v-if="pictureError" class="text-sm text-error">{{ pictureError }}</p>
        <p class="text-xs text-muted">Drawn avatars: “Glyphs” by Matt Houser, CC BY 4.0</p>
    </form>
    <Teleport v-if="actionsTarget" defer :to="actionsTarget">
        <span />
        <UButton type="submit" form="profile-form" label="Continue" :loading="saving" :disabled="!changed" />
    </Teleport>
</template>
