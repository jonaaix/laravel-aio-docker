export default defineEventHandler(() => {
    cancelClaudeLogin();
    return { ok: true };
});
