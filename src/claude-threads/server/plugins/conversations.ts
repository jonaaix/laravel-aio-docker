export default defineNitroPlugin((nitroApp) => {
  markRunningConversationsPaused();
  nitroApp.hooks.hook('close', () => pauseAllConversations());
});
