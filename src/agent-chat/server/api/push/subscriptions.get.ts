export default defineEventHandler((event) => {
    const { endpoint } = getQuery(event);
    return { enabled: isPushEndpoint(endpoint, import.meta.dev) && hasPushSubscription(endpoint, sessionUser(event).id) };
});
