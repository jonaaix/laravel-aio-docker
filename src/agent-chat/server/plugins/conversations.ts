export default defineNitroPlugin((nitroApp) => {
    markRunningConversationsPaused();
    clearUploads();
    nitroApp.hooks.hook('close', () => pauseAllConversations());
});
