export default defineEventHandler((event) => {
    discardUpload(getRouterParam(event, 'id')!);
    return { ok: true };
});
