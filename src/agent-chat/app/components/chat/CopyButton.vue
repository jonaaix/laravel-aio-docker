<script setup lang="ts">
const CONFIRM_MS = 2000;

const props = defineProps<{
    text: string;
    label?: string;
}>();

const { t } = useI18n();

const copied = ref(false);
let reset: ReturnType<typeof setTimeout> | undefined;

async function copy(): Promise<void> {
    await navigator.clipboard.writeText(props.text);
    copied.value = true;
    clearTimeout(reset);
    reset = setTimeout(() => {
        copied.value = false;
    }, CONFIRM_MS);
}

onBeforeUnmount(() => clearTimeout(reset));
</script>

<template>
    <UTooltip :text="copied ? t('Copied') : t('Copy')">
        <UButton
            :icon="label ? undefined : copied ? 'i-heroicons-check' : 'i-heroicons-square-2-stack'"
            :trailing-icon="label && copied ? 'i-heroicons-check' : undefined"
            :label="label"
            :aria-label="copied ? t('Copied') : t('Copy')"
            size="xs"
            color="neutral"
            variant="ghost"
            :class="label ? 'font-mono font-normal text-muted' : ''"
            @click="copy"
        />
    </UTooltip>
</template>
