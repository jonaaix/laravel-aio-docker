export default defineEventHandler(event => toChatUser(setUserAdmin(sessionUser(event), true)));
