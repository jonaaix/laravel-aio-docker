export default defineEventHandler((event) => {
    sessionUser(event);
    return speechServices();
});
