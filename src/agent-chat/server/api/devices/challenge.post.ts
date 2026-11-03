export default defineEventHandler(async (event) => {
    const { deviceId } = await readBody<{ deviceId?: unknown }>(event);
    const device = findDevice(deviceId);
    if (!device) {
        throw createError({ statusCode: 401, statusMessage: 'This device is not paired' });
    }
    return { challenge: deviceChallenges.issue(device.id) };
});
