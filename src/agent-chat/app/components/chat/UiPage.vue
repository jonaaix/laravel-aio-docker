<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import type { UiPage } from '#shared/types/ui-block';

const props = defineProps<{
    page: UiPage;
    title: string | null;
}>();

const { t } = useI18n();

const src = computed(() => apiUrl(props.page.url));
const fileUrl = computed(() => apiUrl(props.page.url.replace('/pages/', '/files/')));
const filename = computed(() => props.page.filename ?? 'page.html');
const viewerOpen = ref(false);
const codeOpen = ref(false);

function download(): void {
    const link = document.createElement('a');
    link.href = fileUrl.value;
    link.download = filename.value;
    link.click();
}

const moreItems = computed<DropdownMenuItem[]>(() => [
    { label: t('Open in new tab'), icon: 'i-heroicons-arrow-top-right-on-square', to: src.value, target: '_blank', external: true },
    { label: t('Download'), icon: 'i-heroicons-arrow-down-tray', onSelect: download },
]);
</script>

<template>
    <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-1">
            <p class="min-w-0 flex-1 truncate font-semibold text-highlighted">
                {{ title ?? filename }}
            </p>
            <UTooltip :text="t('View larger')">
                <UButton icon="i-heroicons-arrows-pointing-out" color="neutral" variant="ghost" class="size-9 justify-center" :aria-label="t('View larger')" @click="viewerOpen = true" />
            </UTooltip>
            <UTooltip :text="t('View code')">
                <UButton icon="i-heroicons-code-bracket" color="neutral" variant="ghost" class="size-9 justify-center" :aria-label="t('View code')" @click="codeOpen = true" />
            </UTooltip>
            <UDropdownMenu :items="moreItems" :content="{ align: 'end' }">
                <UTooltip :text="t('More actions')">
                    <UButton icon="i-heroicons-ellipsis-horizontal" color="neutral" variant="ghost" class="size-9 justify-center" :aria-label="t('More actions')" />
                </UTooltip>
            </UDropdownMenu>
        </div>
        <!-- White in dark mode too: a page without its own background is written for a white canvas. -->
        <iframe
            :src="src"
            :title="title ?? filename"
            sandbox="allow-scripts"
            loading="lazy"
            class="block w-full rounded-md bg-white ring ring-default"
            :style="{ height: `${page.height}px` }"
        />
    </div>

    <ChatPageViewer v-model:open="viewerOpen" :src="src" :title="title ?? filename" />
    <ChatFilePreview
        v-model:open="codeOpen"
        :url="fileUrl"
        :filename="filename"
        details="HTML"
        :preview="textFilePreview(filename)"
        :size="null"
    />
</template>
