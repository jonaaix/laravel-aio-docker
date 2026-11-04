export default defineEventHandler(event => accountStatusFor(sessionUser(event)));
