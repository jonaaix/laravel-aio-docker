<script setup lang="ts">
const { name, ready, locked, editing, save } = useUserName();

const open = computed(() => ready.value && !locked.value && (!name.value || editing.value));
const required = computed(() => !name.value);
const draft = ref('');
const saving = ref(false);
const error = ref<string | undefined>();
const valid = computed(() => normalizeUserName(draft.value) !== null);

watch(open, (isOpen) => {
    if (isOpen) {
        draft.value = name.value ?? '';
        error.value = undefined;
    }
}, { immediate: true });

function close(): void {
    editing.value = false;
}

async function submit(): Promise<void> {
    if (!valid.value || saving.value) {
        return;
    }
    saving.value = true;
    error.value = undefined;
    try {
        await save(draft.value);
    }
    catch (failure) {
        error.value = (failure as { statusMessage?: string }).statusMessage ?? 'Could not save the name';
    }
    finally {
        saving.value = false;
    }
}
</script>

<template>
    <!-- Without a name nothing can be attributed, so the first prompt cannot be dismissed. -->
    <UModal
        :open="open"
        title="Your name"
        :dismissible="!required"
        :close="!required"
        :ui="{ footer: 'justify-end' }"
        @update:open="value => value || close()"
    >
        <template #body>
            <form id="user-name-form" @submit.prevent="submit">
                <UFormField :error="error">
                    <UInput
                        v-model="draft"
                        :maxlength="USER_NAME_MAX_LENGTH"
                        placeholder="Name"
                        aria-label="Your name"
                        autofocus
                        class="w-full"
                    />
                </UFormField>
            </form>
        </template>
        <template #footer>
            <UButton v-if="!required" label="Cancel" color="neutral" variant="outline" @click="close" />
            <UButton type="submit" form="user-name-form" label="Save" :loading="saving" :disabled="!valid" />
        </template>
    </UModal>
</template>
