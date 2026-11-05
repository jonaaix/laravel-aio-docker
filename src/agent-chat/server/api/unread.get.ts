export default defineEventHandler(event => unreadCountsFor(sessionUser(event).id));
