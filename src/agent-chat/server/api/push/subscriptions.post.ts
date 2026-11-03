interface SubscriptionBody {
    userId?: unknown;
    subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
}

export default defineEventHandler(async (event) => {
    const { userId, subscription } = await readBody<SubscriptionBody>(event);
    const user = findUser(userId);
    if (!user) {
        throw createError({ statusCode: 404, statusMessage: 'User not found' });
    }
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || typeof p256dh !== 'string' || typeof auth !== 'string') {
        throw createError({ statusCode: 422, statusMessage: 'A valid push subscription is required' });
    }
    savePushSubscription({ endpoint, userId: user.id, p256dh, auth });
    return { ok: true };
});
