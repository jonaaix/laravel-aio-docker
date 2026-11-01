<script setup lang="ts">
const props = defineProps<{
  title: string;
  active: boolean;
  icon: string;
  iconClass?: string;
  showAllLabel: string;
  showLessLabel: string;
}>();

const expanded = ref(false);
const overflowing = ref(false);
const viewport = ref<HTMLElement | null>(null);

let observer: MutationObserver | null = null;

function follow(): void {
  const element = viewport.value;
  if (!element) {
    return;
  }
  if (!expanded.value) {
    element.scrollTop = element.scrollHeight;
  }
  overflowing.value = element.scrollHeight > element.clientHeight + 1;
}

onMounted(() => {
  follow();
  observer = new MutationObserver(follow);
  observer.observe(viewport.value!, { childList: true, subtree: true, characterData: true });
});

onBeforeUnmount(() => observer?.disconnect());

watch(expanded, () => nextTick(follow));
</script>

<template>
  <div class="mb-3 rounded-xl bg-elevated/40 p-3 ring ring-default">
    <div class="flex h-6 items-center gap-2 text-sm">
      <UIcon v-if="active" name="i-heroicons-arrow-path" class="size-4 shrink-0 animate-spin text-muted" />
      <UIcon v-else :name="props.icon" class="size-4 shrink-0 text-muted" :class="props.iconClass" />
      <UChatShimmer v-if="active" :text="title" class="font-medium" />
      <span v-else class="font-medium text-default">{{ title }}</span>
      <UTooltip v-if="overflowing || expanded" :text="expanded ? showLessLabel : showAllLabel">
        <UButton
          :icon="expanded ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
          :aria-label="expanded ? showLessLabel : showAllLabel"
          color="neutral"
          variant="ghost"
          size="xs"
          square
          class="ms-auto"
          @click="expanded = !expanded"
        />
      </UTooltip>
    </div>
    <div
      ref="viewport"
      class="mt-1"
      :class="expanded ? '' : ['max-h-30 overflow-hidden', overflowing ? 'mask-t-from-75%' : '']"
    >
      <slot :expanded="expanded" />
    </div>
  </div>
</template>
