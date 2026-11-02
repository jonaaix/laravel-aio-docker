import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { asc, desc, eq } from 'drizzle-orm';
import { agents, messages } from '../database/schema';
import type { Agent, AgentResource } from '../../shared/types/agent';
import type { AttachmentReference } from './attachments';

export type AgentRow = typeof agents.$inferSelect;

const INSTRUCTIONS_FILE = 'CLAUDE.md';

export interface AgentChanges {
    name: string;
    role: string;
    model: string | null;
    effort: string | null;
    instructions: string;
    uploads: AttachmentReference[];
    removedResources: string[];
    avatarSeed: string | null;
    avatarUpload: AttachmentReference | null;
    removeAvatar: boolean;
}

export function agentDir(id: string): string {
    return join(resolveDataDir(), 'agents', id);
}

function resources(row: AgentRow): AgentResource[] {
    const dir = agentDir(row.id);
    if (row.lead || !existsSync(dir)) {
        return [];
    }
    return readdirSync(dir, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name !== INSTRUCTIONS_FILE)
        .map(entry => ({ name: entry.name, size: statSync(join(dir, entry.name)).size }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function toAgent(row: AgentRow): Agent {
    return { id: row.id, name: row.name, role: row.role, model: row.model, effort: row.effort, lead: row.lead, instructions: row.instructions, avatarSeed: row.avatarSeed, avatarUrl: avatarUrl(row.avatarFile, row.avatarUpdatedAt), resources: resources(row) };
}

function announce(agent: Agent): Agent {
    publishConversationListEvent({ type: 'agents' });
    return agent;
}

export function leadAgent(): AgentRow {
    const existing = useDatabase().select().from(agents).where(eq(agents.lead, true)).get();
    if (existing) {
        return existing;
    }
    const row: AgentRow = { id: randomUUID(), name: LEAD_AGENT_NAME, role: LEAD_AGENT_ROLE, model: null, effort: DEFAULT_EFFORT, lead: true, instructions: '', avatarSeed: LEAD_AGENT_AVATAR_SEED, avatarFile: null, avatarUpdatedAt: null, createdAt: Date.now() };
    useDatabase().insert(agents).values(row).run();
    return row;
}

export function listAgents(): Agent[] {
    leadAgent();
    return useDatabase().select().from(agents).orderBy(desc(agents.lead), asc(agents.createdAt)).all().map(toAgent);
}

export function findAgent(id: unknown): AgentRow | null {
    if (typeof id !== 'string' || !id) {
        return null;
    }
    return useDatabase().select().from(agents).where(eq(agents.id, id)).get() ?? null;
}

function assertNameFree(name: string, id: string | null): void {
    const taken = useDatabase().select().from(agents).where(eq(agents.name, name)).get();
    if (taken && taken.id !== id) {
        throw createError({ statusCode: 409, statusMessage: 'An agent with this name already exists' });
    }
}

function writeWorkspace(row: AgentRow, changes: AgentChanges): void {
    const dir = agentDir(row.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, INSTRUCTIONS_FILE), row.instructions);
    for (const name of changes.removedResources) {
        const file = basename(name);
        if (file !== INSTRUCTIONS_FILE) {
            rmSync(join(dir, file), { force: true });
        }
    }
    for (const upload of changes.uploads) {
        if (upload.filename !== INSTRUCTIONS_FILE) {
            moveUpload(upload, join(dir, upload.filename));
        }
    }
}

export function createAgent(changes: AgentChanges): Agent {
    assertNameFree(changes.name, null);
    const row: AgentRow = {
        id: randomUUID(),
        name: changes.name,
        role: changes.role,
        model: changes.model,
        effort: changes.effort,
        lead: false,
        instructions: changes.instructions,
        avatarSeed: changes.avatarSeed,
        avatarFile: null,
        avatarUpdatedAt: null,
        createdAt: Date.now(),
    };
    useDatabase().insert(agents).values(row).run();
    writeWorkspace(row, changes);
    return announce(toAgent(applyAvatar(row, changes)));
}

export function updateAgent(row: AgentRow, changes: AgentChanges): Agent {
    assertNameFree(changes.name, row.id);
    const updated: AgentRow = {
        ...row,
        name: changes.name,
        role: changes.role,
        model: changes.model,
        effort: changes.effort,
        instructions: row.lead ? '' : changes.instructions,
        avatarSeed: changes.avatarSeed,
    };
    useDatabase().update(agents).set(updated).where(eq(agents.id, row.id)).run();
    if (!row.lead) {
        writeWorkspace(updated, changes);
    }
    return announce(toAgent(applyAvatar(updated, changes)));
}

function applyAvatar(row: AgentRow, changes: AgentChanges): AgentRow {
    const base = `agent-${row.id}`;
    let avatarFile = row.avatarFile;
    if (changes.avatarUpload) {
        avatarFile = storeUploadedAvatar(changes.avatarUpload, base);
    }
    else if (changes.removeAvatar) {
        removeAvatar(base);
        avatarFile = null;
    }
    if (avatarFile === row.avatarFile) {
        return row;
    }
    const avatar = { avatarFile, avatarUpdatedAt: Date.now() };
    useDatabase().update(agents).set(avatar).where(eq(agents.id, row.id)).run();
    return { ...row, ...avatar };
}

export function deleteAgent(row: AgentRow): void {
    if (row.lead) {
        throw createError({ statusCode: 409, statusMessage: 'The lead agent cannot be deleted' });
    }
    useDatabase().update(messages).set({ agentId: null }).where(eq(messages.agentId, row.id)).run();
    useDatabase().delete(agents).where(eq(agents.id, row.id)).run();
    rmSync(agentDir(row.id), { recursive: true, force: true });
    removeAvatar(`agent-${row.id}`);
    publishConversationListEvent({ type: 'agents' });
}

export function readAgentChanges(body: Record<string, unknown>): AgentChanges {
    const name = normalizeUserName(body.name);
    if (!name) {
        throw createError({ statusCode: 422, statusMessage: 'A name is required' });
    }
    const role = typeof body.role === 'string' ? body.role.trim().slice(0, AGENT_ROLE_MAX_LENGTH) : '';
    if (!role) {
        throw createError({ statusCode: 422, statusMessage: 'A role is required' });
    }
    const removed = Array.isArray(body.removedResources) ? body.removedResources.filter((item): item is string => typeof item === 'string') : [];
    return {
        name,
        role,
        model: normalizeAgentModel(body.model),
        effort: normalizeAgentEffort(body.effort),
        instructions: typeof body.instructions === 'string' ? body.instructions : '',
        uploads: readAttachmentReferences(body.uploads),
        removedResources: removed,
        avatarSeed: typeof body.avatarSeed === 'string' && body.avatarSeed.trim() ? body.avatarSeed.trim().slice(0, AVATAR_SEED_MAX_LENGTH) : null,
        avatarUpload: body.avatarUpload ? readAttachmentReferences([body.avatarUpload])[0]! : null,
        removeAvatar: body.removeAvatar === true,
    };
}
