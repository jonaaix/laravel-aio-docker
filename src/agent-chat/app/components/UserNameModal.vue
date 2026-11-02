<script setup lang="ts">
import type { UploadedFile } from '#shared/types/conversation';

const { user, name, ready, locked, editing, save, setAvatar } = useUserName();

const open = computed(() => ready.value && (!name.value || editing.value));
const required = computed(() => !name.value);
const draft = ref('');
const saving = ref(false);
const pictureBusy = ref(false);
const error = ref<string | undefined>();
const pictureError = ref<string | undefined>();
const fileInput = ref<HTMLInputElement | null>(null);
const valid = computed(() => normalizeUserName(draft.value) !== null);

watch(open, (isOpen) => {
    if (isOpen) {
        draft.value = name.value ?? '';
        error.value = undefined;
        pictureError.value = undefined;
    }
}, { immediate: true });

function close(): void {
    editing.value = false;
}

function failureMessage(failure: unknown, fallback: string): string {
    const data = (failure as { data?: { statusMessage?: string }; statusMessage?: string });
    return data.data?.statusMessage ?? data.statusMessage ?? fallback;
}

async function submit(): Promise<void> {
    if (locked.value) {
        close();
        return;
    }
    if (!valid.value || saving.value) {
        return;
    }
    saving.value = true;
    error.value = undefined;
    try {
        await save(draft.value);
    }
    catch (failure) {
        error.value = failureMessage(failure, 'Could not save the name');
    }
    finally {
        saving.value = false;
    }
}

async function changePicture(upload: Promise<UploadedFile | null>): Promise<void> {
    pictureBusy.value = true;
    pictureError.value = undefined;
    try {
        await setAvatar(await upload);
    }
    catch (failure) {
        pictureError.value = failureMessage(failure, 'Could not change the picture');
    }
    finally {
        pictureBusy.value = false;
    }
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
    <!-- Without a name nothing can be attributed, so the first prompt cannot be dismissed. -->
    <UModal
        :open="open"
        :title="required ? 'Your name' : 'Profile'"
        :dismissible="!required"
        :close="!required"
        :ui="{ footer: 'justify-end' }"
        @update:open="value => value || close()"
    >
        <template #body>
            <form id="user-name-form" class="flex flex-col gap-4" @submit.prevent="submit">
                <div v-if="user" class="flex items-center gap-4">
                    <ParticipantAvatar :participant="{ kind: 'person', name: user.name, image: user.avatarUrl }" class="size-16" />
                    <div v-if="!user.avatarLocked" class="flex flex-col items-start gap-1.5">
                        <div class="flex gap-2">
                            <UButton label="Upload picture" icon="i-heroicons-arrow-up-tray" color="neutral" variant="outline" :loading="pictureBusy" @click="fileInput?.click()" />
                            <UButton v-if="user.avatarUrl" label="Remove" color="neutral" variant="ghost" :disabled="pictureBusy" @click="removePicture" />
                        </div>
                        <p v-if="pictureError" class="text-sm text-error">{{ pictureError }}</p>
                    </div>
                    <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" @change="onPicked">
                </div>
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
            </form>
        </template>
        <template #footer>
            <UButton v-if="!required && !locked" label="Cancel" color="neutral" variant="outline" @click="close" />
            <UButton type="submit" form="user-name-form" :label="locked ? 'Done' : 'Save'" :loading="saving" :disabled="!locked && !valid" />
        </template>
    </UModal>
</template>
