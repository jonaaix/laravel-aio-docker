import type { H3Event } from 'h3';
import type { UserRow } from '../utils/user-store';

const OPEN_ROUTES = [
    { method: 'POST', path: '/api/auth/links' },
    { method: 'POST', path: '/api/auth/session' },
    { method: 'POST', path: '/api/devices' },
    { method: 'POST', path: '/api/devices/challenge' },
    { method: 'POST', path: '/api/devices/token' },
];

function isOpen(method: string, path: string): boolean {
    return path.includes('/api/mcp/') || OPEN_ROUTES.some(route => route.method === method && path.endsWith(route.path));
}

function deviceUser(event: H3Event): UserRow | null {
    const bearer = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '');
    const query = getQuery(event).access_token;
    const deviceId = accessTokenDeviceId(chatKey(), bearer ?? (typeof query === 'string' ? query : undefined));
    const device = deviceId ? findDevice(deviceId) : null;
    if (!device) {
        return null;
    }
    touchDevice(device);
    return findUser(device.userId);
}

export default defineEventHandler((event) => {
    const path = getRequestURL(event).pathname;
    if (event.method === 'OPTIONS' || !path.includes('/api/') || isOpen(event.method, path)) {
        return;
    }
    const sessionId = sessionUserId(chatKey(), getCookie(event, SESSION_COOKIE));
    const user = (sessionId ? findUser(sessionId) : null) ?? deviceUser(event);
    if (!user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }
    event.context.user = user;
});
