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
    if (!isPushEndpoint(endpoint, import.meta.dev) || !isShortToken(p256dh) || !isShortToken(auth)) {
        throw createError({ statusCode: 422, statusMessage: 'A valid push subscription is required' });
    }
    if (!hasPushSubscription(endpoint, user.id) && countPushSubscriptions(user.id) >= MAX_SUBSCRIPTIONS_PER_USER) {
        throw createError({ statusCode: 422, statusMessage: 'Too many devices are registered for this person' });
    }
    savePushSubscription({ endpoint, userId: user.id, p256dh, auth });
    return { ok: true };
});
