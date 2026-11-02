<script setup lang="ts">
const { name, locked, editing, save } = useUserName();

const open = computed(() => !locked.value && (!name.value || editing.value));
const required = computed(() => !name.value);
const draft = ref('');
const valid = computed(() => normalizeUserName(draft.value) !== null);

watch(open, (isOpen) => {
    if (isOpen) {
        draft.value = name.value ?? '';
    }
}, { immediate: true });

function close(): void {
    editing.value = false;
}

function submit(): void {
    if (valid.value) {
        save(draft.value);
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
                <UInput
                    v-model="draft"
                    :maxlength="USER_NAME_MAX_LENGTH"
                    placeholder="Name"
                    aria-label="Your name"
                    autofocus
                    class="w-full"
                />
            </form>
        </template>
        <template #footer>
            <UButton v-if="!required" label="Cancel" color="neutral" variant="outline" @click="close" />
            <UButton type="submit" form="user-name-form" label="Save" :disabled="!valid" />
        </template>
    </UModal>
</template>
