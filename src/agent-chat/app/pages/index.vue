<script setup lang="ts">
const input = ref('');
const sending = ref(false);
const { start } = useConversations();
const { attachments, uploading, ready, add: attach, remove: removeAttachment, take: takeAttachments } = useAttachments();
const { profile: account, loaded: accountLoaded } = useAccount();

async function submit(): Promise<void> {
    const text = input.value.trim();
    if ((!text && ready.value.length === 0) || uploading.value || sending.value) {
        return;
    }
    sending.value = true;
    try {
        const conversation = await start(text, takeAttachments());
        input.value = '';
        await navigateTo(`/c/${conversation.id}`);
    }
    finally {
        sending.value = false;
    }
}
</script>

<template>
    <UDashboardPanel id="new-conversation">
        <template #header>
            <UDashboardNavbar title="New Conversation" />
        </template>

        <template #body>
            <UContainer class="flex flex-1 flex-col justify-center gap-6 py-8 sm:gap-8">
                <h1 class="text-center text-2xl font-bold tracking-tight text-highlighted lg:text-3xl">
                    What should we work on?
                </h1>
                <ChatSignInNotice v-if="accountLoaded && !account" />
                <ChatUsageNotice v-else />
                <ChatComposer
                    v-model="input"
                    placeholder="Ask anything…"
                    :status="sending ? 'submitted' : 'ready'"
                    :disabled="sending"
                    :attachments="attachments"
                    :uploading="uploading"
                    autofocus
                    @submit="submit"
                    @attach="attach"
                    @remove="removeAttachment"
                />
                <ChatDropZone @drop="attach" />
            </UContainer>
        </template>
    </UDashboardPanel>
</template>
