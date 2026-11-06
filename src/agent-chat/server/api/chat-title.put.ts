export default defineEventHandler(async (event) => {
    const { title } = await readBody<{ title?: unknown }>(event);
    return { title: setChatTitle(title) };
});
