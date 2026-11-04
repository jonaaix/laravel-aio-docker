export default defineEventHandler(event => readsFor(sessionUser(event).id));
