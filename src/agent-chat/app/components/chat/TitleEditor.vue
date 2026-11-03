<script setup lang="ts">
const MAX_LENGTH = 120;

const props = defineProps<{
    title: string;
    editable: boolean;
    save: (title: string) => Promise<void>;
}>();

const { t } = useI18n();

const editing = ref(false);
const draft = ref('');
const saving = ref(false);
const failed = ref(false);
const field = ref<HTMLElement | null>(null);

async function startEditing(): Promise<void> {
    draft.value = props.title;
    failed.value = false;
    editing.value = true;
    await nextTick();
    const input = field.value?.querySelector('input');
    input?.focus();
    input?.select();
}

function cancel(): void {
    if (!saving.value) {
        editing.value = false;
    }
}

async function commit(): Promise<void> {
    const title = draft.value.trim();
    if (!title || title === props.title) {
        editing.value = false;
        return;
    }
    saving.value = true;
    try {
        await props.save(title);
        editing.value = false;
    }
    catch {
        failed.value = true;
    }
    finally {
        saving.value = false;
    }
}
</script>

<template>
    <form v-if="editing" ref="field" class="w-lg max-w-full" @submit.prevent="commit">
        <UInput
            v-model="draft"
            :maxlength="MAX_LENGTH"
            :loading="saving"
            :color="failed ? 'error' : 'neutral'"
            :highlight="failed"
            :aria-label="t('Conversation title')"
            class="w-full"
            @keydown.esc.prevent="cancel"
            @blur="failed || cancel()"
        />
    </form>
    <UTooltip v-else-if="editable" :text="t('Rename')">
        <button
            type="button"
            class="h-9 min-w-0 truncate rounded-md px-2 text-start transition-colors duration-500 ease-out hover:bg-elevated/60"
            @click="startEditing"
        >
            {{ title }}
        </button>
    </UTooltip>
    <span v-else class="min-w-0 truncate px-2">{{ title }}</span>
</template>
