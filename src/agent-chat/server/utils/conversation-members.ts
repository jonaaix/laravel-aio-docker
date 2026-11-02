import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { agents, conversationAgents, conversations } from '../database/schema';
import type { AnnouncedAgent } from '../database/schema';
import type { AgentRow } from './agent-store';

export interface AgentSessionState {
    sessionRef: string;
    started: boolean;
    announcedAgents: AnnouncedAgent[];
}

export function conversationAgentIds(conversationId: string): string[] {
    return memberAgents(conversationId).map(agent => agent.id);
}

export function memberAgents(conversationId: string): AgentRow[] {
    return useDatabase()
        .select({ agent: agents })
        .from(conversationAgents)
        .innerJoin(agents, eq(agents.id, conversationAgents.agentId))
        .where(eq(conversationAgents.conversationId, conversationId))
        .orderBy(asc(conversationAgents.addedAt))
        .all()
        .map(row => row.agent);
}

export function setConversationAgent(conversationId: string, agentId: string, member: boolean): void {
    const database = useDatabase();
    if (member) {
        database.insert(conversationAgents).values({ conversationId, agentId, addedAt: Date.now() }).onConflictDoNothing().run();
    }
    else {
        database.delete(conversationAgents).where(memberRow(conversationId, agentId)).run();
    }
}

export function agentSessionState(conversationId: string, agent: AgentRow): AgentSessionState | null {
    const database = useDatabase();
    if (agent.lead) {
        const row = database.select().from(conversations).where(eq(conversations.id, conversationId)).get();
        return row ? { sessionRef: row.agentSessionRef, started: row.agentSessionStarted, announcedAgents: row.announcedAgents } : null;
    }
    const row = database.select().from(conversationAgents).where(memberRow(conversationId, agent.id)).get();
    if (!row) {
        return null;
    }
    if (!row.sessionRef) {
        const sessionRef = randomUUID();
        database.update(conversationAgents).set({ sessionRef }).where(memberRow(conversationId, agent.id)).run();
        return { sessionRef, started: row.sessionStarted, announcedAgents: row.announcedAgents };
    }
    return { sessionRef: row.sessionRef, started: row.sessionStarted, announcedAgents: row.announcedAgents };
}

export function saveAgentSessionState(conversationId: string, agent: AgentRow, changes: Partial<Omit<AgentSessionState, 'sessionRef'>>): void {
    const database = useDatabase();
    if (agent.lead) {
        database.update(conversations).set({ agentSessionStarted: changes.started, announcedAgents: changes.announcedAgents }).where(eq(conversations.id, conversationId)).run();
        return;
    }
    database.update(conversationAgents).set({ sessionStarted: changes.started, announcedAgents: changes.announcedAgents }).where(memberRow(conversationId, agent.id)).run();
}

function memberRow(conversationId: string, agentId: string) {
    return and(eq(conversationAgents.conversationId, conversationId), eq(conversationAgents.agentId, agentId));
}
