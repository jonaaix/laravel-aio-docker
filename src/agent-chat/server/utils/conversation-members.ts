import { and, asc, eq } from 'drizzle-orm';
import { conversationAgents } from '../database/schema';

export function conversationAgentIds(conversationId: string): string[] {
    return useDatabase()
        .select({ agentId: conversationAgents.agentId })
        .from(conversationAgents)
        .where(eq(conversationAgents.conversationId, conversationId))
        .orderBy(asc(conversationAgents.addedAt))
        .all()
        .map(row => row.agentId);
}

export function setConversationAgent(conversationId: string, agentId: string, member: boolean): void {
    const database = useDatabase();
    if (member) {
        database.insert(conversationAgents).values({ conversationId, agentId, addedAt: Date.now() }).onConflictDoNothing().run();
    }
    else {
        database.delete(conversationAgents).where(and(eq(conversationAgents.conversationId, conversationId), eq(conversationAgents.agentId, agentId))).run();
    }
}
