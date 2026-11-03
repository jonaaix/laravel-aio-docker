export default defineEventHandler(async (event) => {
    const { code, publicKey, label } = await readBody<{ code?: unknown; publicKey?: unknown; label?: unknown }>(event);
    const key = readDevicePublicKey(publicKey);
    if (!key || typeof label !== 'string') {
        throw createError({ statusCode: 422, statusMessage: 'A public key and a device name are required' });
    }
    const userId = pairingCodes.claim(code);
    const user = userId ? findUser(userId) : null;
    if (!user) {
        throw createError({ statusCode: 401, statusMessage: 'This pairing link is invalid or has expired' });
    }
    const device = createDevice(user.id, key, label);
    publishConversationListEvent({ type: 'devices', userId: user.id });
    return { deviceId: device.id };
});
