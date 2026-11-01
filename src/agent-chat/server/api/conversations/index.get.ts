export default defineEventHandler((event) => listConversations(getQuery(event).archived === 'true'));
