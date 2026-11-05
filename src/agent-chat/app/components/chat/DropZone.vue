<script setup lang="ts">
const emit = defineEmits<{ drop: [files: File[]] }>();

const { t } = useI18n();

const active = ref(false);
let depth = 0;

function carriesFiles(event: DragEvent): boolean {
    return event.dataTransfer?.types.includes('Files') ?? false;
}

function onDragEnter(event: DragEvent): void {
    if (!carriesFiles(event)) {
        return;
    }
    event.preventDefault();
    depth++;
    active.value = true;
}

function onDragOver(event: DragEvent): void {
    if (carriesFiles(event)) {
        event.preventDefault();
    }
}

function onDragLeave(event: DragEvent): void {
    if (!carriesFiles(event)) {
        return;
    }
    depth = Math.max(0, depth - 1);
    active.value = depth > 0;
}

function onDrop(event: DragEvent): void {
    if (!carriesFiles(event)) {
        return;
    }
    event.preventDefault();
    depth = 0;
    active.value = false;
    const files = [...(event.dataTransfer?.files ?? [])];
    if (files.length > 0) {
        emit('drop', files);
    }
}

useActiveListener(() => window, 'dragenter', onDragEnter);
useActiveListener(() => window, 'dragover', onDragOver);
useActiveListener(() => window, 'dragleave', onDragLeave);
useActiveListener(() => window, 'drop', onDrop);
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition-opacity duration-[180ms] ease-out"
            leave-active-class="transition-opacity duration-[160ms] ease-in"
            enter-from-class="opacity-0"
            leave-to-class="opacity-0"
        >
            <div
                v-if="active"
                class="pointer-events-none fixed inset-3 z-40 flex items-center justify-center rounded-2xl bg-default/80 outline-2 outline-dashed outline-accented backdrop-blur-sm"
            >
                <span class="flex items-center gap-2 text-base font-medium text-highlighted">
                    <UIcon name="i-heroicons-paper-clip" class="size-5" />
                    {{ t('Drop files to attach') }}
                </span>
            </div>
        </Transition>
    </Teleport>
</template>
