export default defineEventHandler(async (event) => {
    const { deviceId, challenge, signature } = await readBody<{ deviceId?: unknown; challenge?: unknown; signature?: unknown }>(event);
    const device = findDevice(deviceId);
    const user = device ? findUser(device.userId) : null;
    if (!device || !user || !deviceChallenges.consume(challenge, device.id) || !isDeviceSignature(devicePublicKey(device), challenge as string, signature)) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }
    touchDevice(device);
    return { ...createAccessToken(chatKey(), device.id), user: toChatUser(user) };
});
