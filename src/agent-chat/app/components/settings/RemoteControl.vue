<script setup lang="ts">
const { user } = useUserName();

const link = computed(() => user.value ? `${window.location.origin}${useRuntimeConfig().app.baseURL}#mobile-connect=${user.value.id}` : '');
</script>

<template>
    <div class="flex flex-col gap-4">
        <UFormField v-if="user" label="Mobile app link">
            <div class="flex items-center gap-1">
                <UInput :model-value="link" readonly aria-label="Mobile app link" class="w-full" :ui="{ base: 'font-mono text-xs' }" />
                <ChatCopyButton :text="link" />
            </div>
        </UFormField>
    </div>
</template>
