import { and, count, eq, inArray } from 'drizzle-orm';
import { pushSubscriptions } from '../database/schema';
import type { StoredSubscription } from './push-notifier';

export function savePushSubscription(subscription: StoredSubscription): void {
    useDatabase()
        .insert(pushSubscriptions)
        .values({ ...subscription, createdAt: Date.now() })
        .onConflictDoUpdate({
            target: [pushSubscriptions.endpoint, pushSubscriptions.userId],
            set: { p256dh: subscription.p256dh, auth: subscription.auth, language: subscription.language, vapidPublicKey: subscription.vapidPublicKey, vapidPrivateKey: subscription.vapidPrivateKey, hubRef: subscription.hubRef },
        })
        .run();
}

export function hasPushSubscription(endpoint: string, userId: string): boolean {
    return !!useDatabase()
        .select({ endpoint: pushSubscriptions.endpoint })
        .from(pushSubscriptions)
        .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)))
        .get();
}

export function countPushSubscriptions(userId: string): number {
    return useDatabase().select({ total: count() }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).get()?.total ?? 0;
}

export function removePushSubscription(endpoint: string, userId: string): void {
    useDatabase()
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)))
        .run();
}

export function subscriptionsForUsers(userIds: string[]): StoredSubscription[] {
    if (userIds.length === 0) {
        return [];
    }
    return useDatabase()
        .select({ endpoint: pushSubscriptions.endpoint, userId: pushSubscriptions.userId, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth, language: pushSubscriptions.language, vapidPublicKey: pushSubscriptions.vapidPublicKey, vapidPrivateKey: pushSubscriptions.vapidPrivateKey, hubRef: pushSubscriptions.hubRef })
        .from(pushSubscriptions)
        .where(inArray(pushSubscriptions.userId, userIds))
        .all()
        .filter((row): row is StoredSubscription => row.vapidPublicKey !== null && row.vapidPrivateKey !== null);
}

