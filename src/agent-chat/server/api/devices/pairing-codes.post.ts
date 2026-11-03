export default defineEventHandler(event => pairingCodes.issue(sessionUser(event).id));
