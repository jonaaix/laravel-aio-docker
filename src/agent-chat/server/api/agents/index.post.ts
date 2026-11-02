export default defineEventHandler(async event => createAgent(readAgentChanges(await readBody<Record<string, unknown>>(event))));
