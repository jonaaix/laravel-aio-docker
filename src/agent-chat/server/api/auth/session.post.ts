const ledger = createNonceLedger();
const SESSION_MAX_AGE_S = 400 * 24 * 60 * 60;

function isSecureContext(url: URL): boolean {
    return url.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

export default defineEventHandler(async (event) => {
    const signIn = redeemSignIn(chatKey(), await readBody(event), ledger);
    if (!signIn) {
        throw createError({ statusCode: 401, statusMessage: 'This sign-in link is invalid or has expired' });
    }
    const signedIn = signInUser(signIn.name, signIn.userRef);
    if (!signedIn) {
        throw createError({ statusCode: 409, statusMessage: 'This name is already taken' });
    }
    if (signedIn.blockedAt) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }
    const user = signIn.avatarUrl ? await syncLinkedAvatar(signedIn, signIn.avatarUrl) : signedIn;
    const secure = isSecureContext(getRequestURL(event));
    // Embedded in the Laravel app the chat is a third-party frame; only a partitioned, cross-site cookie survives there.
    setCookie(event, SESSION_COOKIE, createSessionValue(chatKey(), user.id), {
        httpOnly: true,
        path: '/',
        maxAge: SESSION_MAX_AGE_S,
        ...(secure ? { secure: true, sameSite: 'none', partitioned: true } : { sameSite: 'lax' }),
    });
    return toChatUser(user);
});
