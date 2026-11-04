<script setup lang="ts">
import type { UploadedFile } from '#shared/types/conversation';
import type { ChatUser } from '#shared/types/user';

const UNLOCK_TAPS = 7;
const UNLOCK_TAP_GAP_MS = 600;

const emit = defineEmits<{ unlocked: [] }>();
const { t } = useI18n();

const { user, setAvatar, setAvatarSeed } = useUserName();

const pictureBusy = ref(false);
const pictureError = ref<string | undefined>();
const fileInput = ref<HTMLInputElement | null>(null);

function failureMessage(failure: unknown, fallback: string): string {
    const data = (failure as { data?: { statusMessage?: string }; statusMessage?: string });
    return data.data?.statusMessage ?? data.statusMessage ?? fallback;
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
        pictureError.value = failureMessage(failure, t('Could not change the picture'));
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

let unlockTaps = 0;
let lastUnlockTap = 0;

async function countUnlockTap(): Promise<void> {
    if (!user.value || user.value.admin) {
        return;
    }
    const now = performance.now();
    unlockTaps = now - lastUnlockTap < UNLOCK_TAP_GAP_MS ? unlockTaps + 1 : 1;
    lastUnlockTap = now;
    if (unlockTaps < UNLOCK_TAPS) {
        return;
    }
    unlockTaps = 0;
    user.value = await apiFetch<ChatUser>('admin/claim', { method: 'POST' });
    emit('unlocked');
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
    <div class="flex flex-col gap-4">
        <UFormField v-if="user" :label="t('Name')">
            <UInput :model-value="user.name" disabled class="w-full sm:max-w-sm" />
        </UFormField>
        <div v-if="user" class="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div class="flex shrink-0 items-center gap-3 sm:w-28 sm:flex-col">
                <ParticipantAvatar :participant="{ kind: 'person', name: user.name, seed: user.avatarSeed, image: user.avatarUrl }" class="size-20 select-none" @click="countUnlockTap" />
                <div v-if="!user.avatarLocked" class="flex gap-2 sm:w-full sm:flex-col">
                    <UButton :label="t('Upload')" icon="i-heroicons-arrow-up-tray" color="neutral" variant="outline" class="sm:w-full sm:justify-center" :loading="pictureBusy" @click="fileInput?.click()" />
                    <UButton v-if="user.avatarUrl" :label="t('Remove')" color="neutral" variant="ghost" class="sm:w-full sm:justify-center" :disabled="pictureBusy" @click="removePicture" />
                </div>
                <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" @change="onPicked">
            </div>
            <AvatarChoice
                v-if="!user.avatarLocked"
                kind="person"
                :current="user.avatarUrl ? null : user.avatarSeed"
                :styles="PERSON_STYLE_PREFIXES"
                size="lg"
                class="min-w-0 flex-1"
                @select="pickAvatar"
            />
        </div>
        <p v-if="pictureError" class="text-sm text-error">{{ pictureError }}</p>
        <p class="text-xs text-muted">{{ t('Drawn avatars: “Glyphs” by Matt Houser and “Dylan” by Natalia Spivak, CC BY 4.0; “Notionists” by Zoish, CC0') }}</p>
    </div>
</template>
