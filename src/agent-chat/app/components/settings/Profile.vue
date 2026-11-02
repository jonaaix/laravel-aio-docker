<script setup lang="ts">
import type { UploadedFile } from '#shared/types/conversation';

defineProps<{ actionsTarget: string }>();
const emit = defineEmits<{ saved: [] }>();

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

async function submit(): Promise<void> {
    if (locked.value || !changed.value || saving.value) {
        return;
    }
    saving.value = true;
    error.value = undefined;
    try {
        await save(draft.value);
        draft.value = name.value ?? '';
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
        <div v-if="user" class="flex items-center gap-4">
            <ParticipantAvatar :participant="{ kind: 'person', name: user.name, seed: user.avatarSeed, image: user.avatarUrl }" class="size-16" />
            <div v-if="!user.avatarLocked" class="flex flex-col items-start gap-1.5">
                <div class="flex gap-2">
                    <UButton label="Upload picture" icon="i-heroicons-arrow-up-tray" color="neutral" variant="outline" :loading="pictureBusy" @click="fileInput?.click()" />
                    <UButton v-if="user.avatarUrl" label="Remove" color="neutral" variant="ghost" :disabled="pictureBusy" @click="removePicture" />
                </div>
                <p v-if="pictureError" class="text-sm text-error">{{ pictureError }}</p>
            </div>
            <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" @change="onPicked">
        </div>
        <AvatarChoice
            v-if="user && !user.avatarLocked"
            kind="person"
            :current="user.avatarUrl ? null : user.avatarSeed"
            @select="pickAvatar"
        />
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
        <p class="text-xs text-muted">Drawn avatars: “Glyphs” by Matt Houser, CC BY 4.0</p>
    </form>
    <Teleport defer :to="actionsTarget">
        <span />
        <UButton type="submit" form="profile-form" label="Save" :loading="saving" :disabled="locked || !changed" />
    </Teleport>
</template>
