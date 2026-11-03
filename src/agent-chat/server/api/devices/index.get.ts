export default defineEventHandler(event => listDevices(sessionUser(event).id));
