export default defineEventHandler(async (event) => {
  const { text } = await readBody<{ text?: string }>(event);
  if (!text?.trim()) {
    throw createError({ statusCode: 422, statusMessage: 'Message text is required' });
  }
  const workingDir = useRuntimeConfig().workingDir || process.cwd();
  const conversation = createConversation(titleFromPrompt(text), workingDir);
  useConversationRuntime(conversation.id).send(text);
  return summarize(findConversation(conversation.id)!);
});
