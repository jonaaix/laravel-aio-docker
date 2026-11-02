import { and, asc, eq } from 'drizzle-orm';
import { agents, conversationAgents, conversations } from '../database/schema';
import type { AnnouncedAgent } from '../database/schema';

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

export function takeMembershipNotice(conversationId: string): string | null {
    const database = useDatabase();
    const announced = database.select({ announcedAgents: conversations.announcedAgents }).from(conversations).where(eq(conversations.id, conversationId)).get()?.announcedAgents ?? [];
    const members: AnnouncedAgent[] = database
        .select({ id: agents.id, name: agents.name })
        .from(conversationAgents)
        .innerJoin(agents, eq(agents.id, conversationAgents.agentId))
        .where(eq(conversationAgents.conversationId, conversationId))
        .orderBy(asc(conversationAgents.addedAt))
        .all();
    const left = announced.filter(agent => !members.some(member => member.id === agent.id));
    const joined = members.filter(member => !announced.some(agent => agent.id === member.id));
    if (left.length === 0 && joined.length === 0) {
        return null;
    }
    database.update(conversations).set({ announcedAgents: members }).where(eq(conversations.id, conversationId)).run();
    return [
        ...left.map(agent => `<status>${agent.name} left the chat.</status>`),
        ...joined.map(agent => `<status>${agent.name} joined the chat.</status>`),
    ].join('\n');
}
