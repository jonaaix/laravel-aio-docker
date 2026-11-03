import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ClaudeEvent } from '#claude-threads/claude/cli';
import type { BackgroundTask, ChatMessage, ChatPart, ConversationSummary, QueuedMessage, TurnOutcome } from '../../shared/types/conversation';
import { AgentSession, type AgentSessionHooks, type QueuedPrompt } from './agent-session';
import type { AgentRow } from './agent-store';
import type { StoredFile } from './conversation-files';
import type { UserRow } from './user-store';

const TITLE_LENGTH = 60;
const TITLE_AFTER_USER_MESSAGES = 3;
const IDLE_PAUSE_MS = 30 * 60 * 1000;
const HANDOFF_LIMIT = 25;
const MISSED_MESSAGE_LIMIT = 40;

interface PromptAuthor {
    name: string;
    changed: boolean;
    person: boolean;
}

interface PendingMessage extends QueuedMessage {
    text: string;
    attachments: StoredFile[];
    sender: UserRow | null;
    agentId: string;
}

class ConversationRuntime {
    private readonly sessions = new Map<string, AgentSession>();
    private pending: PendingMessage[] = [];
    private handoffs = 0;
    private pausing = false;
    private serverOrigin = '';
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private titleRequestRef: string | null = null;
    private readonly mcpToken = randomBytes(24).toString('hex');
    private readonly hooks: AgentSessionHooks = {
        userMessage: (session, queued) => this.addUserMessage(queued.parts, queued.sender, session),
        turnEnded: (session, message, outcome) => this.afterTurn(session, message, outcome),
        controlResponse: event => this.applyTitle(event),
        changed: () => this.publishStatus(),
        exited: () => this.publishStatus(),
    };

    constructor(private readonly conversationId: string) {}

    get turnActive(): boolean {
        return this.pending.length > 0 || [...this.sessions.values()].some(session => session.turnActive);
    }

    get queuedMessages(): QueuedMessage[] {
        return [
            ...[...this.sessions.values()].flatMap(session => session.queuedMessages),
            ...this.pending.map(({ ref, parts, createdAt, agentId }) => ({ ref, parts, createdAt, agentId })),
        ];
    }

    get answeringAgentId(): string | null {
        return [...this.sessions.values()].find(session => session.answering)?.agentId ?? null;
    }

    get runningBackgroundTasks(): BackgroundTask[] {
        return [...this.sessions.values()].flatMap(session => session.backgroundTasks);
    }

    acceptsMcpToken(token: string): boolean {
        return token === this.mcpToken;
    }

    attachFile(path: string, caption?: string): string {
        const session = [...this.sessions.values()].find(candidate => candidate.answering);
        if (!session) {
            throw new Error('Files can only be sent while answering.');
        }
        return session.attachFile(path, caption);
    }

    send(text: string, attachments: StoredFile[], serverOrigin: string, sender: UserRow | null): void {
        const conversation = findConversation(this.conversationId);
        if (!conversation) {
            throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });
        }
        if (conversation.archivedAt !== null) {
            throw createError({ statusCode: 409, statusMessage: 'Conversation is archived' });
        }
        this.serverOrigin = serverOrigin;
        this.handoffs = 0;
        const target = this.addressedAgent(text);
        const parts = messageParts(this.conversationId, text, attachments);
        const busy = [...this.sessions.values()].find(session => session.turnActive);
        if (busy?.agentId === target.id && busy.running && this.pending.length === 0) {
            const prompt = this.buildPrompt(target, promptWithAttachments(this.conversationId, text, attachments), this.personAuthor(target, sender, busy.lastQueuedSenderId), null);
            busy.enqueue({ ref: randomUUID(), parts, createdAt: Date.now(), agentId: target.id, prompt, sender });
            this.publishStatus();
            return;
        }
        if (busy || this.pending.length > 0) {
            this.pending.push({ ref: randomUUID(), parts, createdAt: Date.now(), text, attachments, sender, agentId: target.id });
            this.publishStatus();
            return;
        }
        this.deliverMessage(target, text, attachments, sender);
    }

    private deliverMessage(agent: AgentRow, text: string, attachments: StoredFile[], sender: UserRow | null): void {
        const session = this.sessionFor(agent);
        const prompt = this.buildPrompt(agent, promptWithAttachments(this.conversationId, text, attachments), this.personAuthor(agent, sender, undefined), null);
        this.startIfIdle(session, agent);
        this.addUserMessage(messageParts(this.conversationId, text, attachments), sender, session);
        session.deliver(prompt);
        this.publishStatus();
    }

    private deliverHandoff(agent: AgentRow, author: AgentRow, message: ChatMessage): void {
        const session = this.sessionFor(agent);
        const prompt = this.buildPrompt(agent, plainMessageText(message), { name: author.name, changed: true, person: false }, message.id);
        this.startIfIdle(session, agent);
        session.deliver(prompt);
        this.publishStatus();
    }

    private afterTurn(session: AgentSession, message: ChatMessage | null, outcome: TurnOutcome): void {
        const author = findAgent(session.agentId);
        const step = afterTurnStep({
            pausing: this.pausing,
            sessionBusy: session.turnActive,
            hasQueued: this.pending.length > 0,
            stopped: outcome === 'stopped',
            failed: outcome === 'failed',
            handoffs: this.handoffs,
            handoffLimit: HANDOFF_LIMIT,
            findTarget: () => {
                if (!author || !message) {
                    return null;
                }
                const agent = handoffTarget(plainMessageText(message), this.reachableAgents().filter(candidate => candidate.id !== author.id));
                return agent ? { agent, author, message } : null;
            },
        });
        if (step.action === 'next-queued') {
            const next = this.pending.shift()!;
            const agent = this.reachableAgents().find(candidate => candidate.id === next.agentId) ?? leadAgent();
            this.deliverMessage(agent, next.text, next.attachments, next.sender);
        }
        else if (step.action === 'handoff') {
            this.handoffs += 1;
            this.deliverHandoff(step.target.agent, step.target.author, step.target.message);
        }
        else if (step.action === 'finish' || step.action === 'limit') {
            if (step.action === 'limit') {
                publishConversationEvent(this.conversationId, { type: 'error', message: `Stopped after ${HANDOFF_LIMIT} hand-overs between agents. Reply to continue.` });
            }
            if (!step.notify) {
                this.publishStatus();
                return;
            }
            updateConversation(this.conversationId, { lastAnswerAt: Date.now() });
            this.publishStatus();
            notifyAnswerFinished(this.conversationId, session.agentId, message, outcome === 'failed');
        }
    }

    private reachableAgents(): AgentRow[] {
        return [leadAgent(), ...memberAgents(this.conversationId)];
    }

    private addressedAgent(text: string): AgentRow {
        const agents = this.reachableAgents();
        const lastAnswering = lastAnsweringAgentId(this.conversationId);
        return mentionedAgent(text, agents) ?? agents.find(agent => agent.id === lastAnswering) ?? agents[0]!;
    }

    private personAuthor(agent: AgentRow, sender: UserRow | null, queuedSenderId: string | null | undefined): PromptAuthor | null {
        if (!sender) {
            return null;
        }
        const previous = queuedSenderId === undefined ? lastUserSenderId(this.conversationId, agent.id) : queuedSenderId;
        return { name: sender.name, changed: sender.id !== previous, person: true };
    }

    private buildPrompt(agent: AgentRow, body: string, author: PromptAuthor | null, excludedMessageId: string | null): string {
        const state = agentSessionState(this.conversationId, agent)!;
        const members = memberAgents(this.conversationId);
        const others = members.filter(member => member.id !== agent.id).map(({ id, name }) => ({ id, name }));
        const blocks: string[] = [];
        if (!state.started) {
            blocks.push(rosterBlock(agent, leadAgent(), members, this.peopleNames(author?.person ? author.name : null)));
        }
        else {
            const notice = membershipNotice(state.announcedAgents, others);
            if (notice) {
                blocks.push(notice);
            }
        }
        saveAgentSessionState(this.conversationId, agent, { announcedAgents: others });
        const missed = missedMessagesBlock(missedMessages(this.conversationId, agent.id, excludedMessageId, MISSED_MESSAGE_LIMIT).map(message => ({ author: this.authorName(message), text: plainMessageText(message) })));
        if (missed) {
            blocks.push(missed);
        }
        if (author && (author.changed || missed)) {
            blocks.push(`<from>${author.name}</from>`);
        }
        blocks.push(body);
        return blocks.join('\n');
    }

    private peopleNames(currentSender: string | null): string[] {
        const names = conversationSenderIds(this.conversationId).map(id => findUser(id)?.name).filter((name): name is string => Boolean(name));
        return currentSender && !names.includes(currentSender) ? [...names, currentSender] : names;
    }

    private authorName(message: ChatMessage): string {
        if (message.role === 'assistant') {
            return findAgent(message.metadata?.agentId)?.name ?? leadAgent().name;
        }
        return findUser(message.metadata?.senderId)?.name ?? 'Someone';
    }

    private sessionFor(agent: AgentRow): AgentSession {
        const existing = this.sessions.get(agent.id);
        if (existing) {
            return existing;
        }
        const session = new AgentSession(this.conversationId, agent.id, this.hooks);
        this.sessions.set(agent.id, session);
        return session;
    }

    private startIfIdle(session: AgentSession, agent: AgentRow): void {
        this.clearIdlePause();
        if (session.running) {
            return;
        }
        const conversation = findConversation(this.conversationId)!;
        const state = agentSessionState(this.conversationId, agent)!;
        const workingDir = agent.lead ? conversation.workingDir : agentDir(agent.id);
        mkdirSync(workingDir, { recursive: true });
        session.start({
            workingDir,
            sessionRef: state.sessionRef,
            resume: state.started && claudeSessionExists(workingDir, state.sessionRef),
            model: agent.model || useRuntimeConfig().claudeModel || undefined,
            effort: agent.effort ?? undefined,
            appendSystemPrompt: agentSystemPrompt(agent, leadAgent(), conversation.workingDir, workingDir),
            deniedTools: agent.lead ? [] : projectWriteRules(conversation.workingDir),
            mcpConfigPath: this.writeMcpConfig(),
        });
        if (agent.lead && conversation.titleRenamed) {
            session.sendControlRequest({ subtype: 'rename_session', title: conversation.title });
        }
        saveAgentSessionState(this.conversationId, agent, { started: true });
    }

    private addUserMessage(parts: ChatPart[], sender: UserRow | null, session: AgentSession): void {
        const message = appendMessage(this.conversationId, 'user', parts, session.agentId, sender);
        publishConversationEvent(this.conversationId, { type: 'message', message });
        if (!findConversation(this.conversationId)?.titleRenamed) {
            this.requestTitle(this.sessions.get(leadAgent().id)?.running ? this.sessions.get(leadAgent().id)! : session);
        }
    }

    removeAgent(agentId: string): void {
        const session = this.sessions.get(agentId);
        if (!session) {
            return;
        }
        this.sessions.delete(agentId);
        void session.kill().then(() => this.publishStatus());
    }

    rename(title: string): void {
        this.titleRequestRef = null;
        updateConversation(this.conversationId, { title, titleRenamed: true });
        this.sessions.get(leadAgent().id)?.sendControlRequest({ subtype: 'rename_session', title });
        this.publishTitle(title);
    }

    private publishTitle(title: string): void {
        publishConversationEvent(this.conversationId, { type: 'title', title });
        this.publishSummary();
    }

    private requestTitle(session: AgentSession): void {
        const userMessages = listUserMessages(this.conversationId);
        if (userMessages.length !== TITLE_AFTER_USER_MESSAGES) {
            return;
        }
        const description = userMessages
            .map(message => message.parts.flatMap(part => part.type === 'text' ? [part.text.trim()] : []).join('\n'))
            .filter(Boolean)
            .map(text => `User: ${text}`)
            .join('\n\n');
        if (description) {
            this.titleRequestRef = session.sendControlRequest({ subtype: 'generate_session_title', description, persist: true });
        }
    }

    private applyTitle(event: ClaudeEvent): void {
        const { request_id: requestRef, response } = (event.response ?? {}) as { request_id?: string; response?: { title?: unknown } };
        if (!requestRef || requestRef !== this.titleRequestRef) {
            return;
        }
        this.titleRequestRef = null;
        const title = typeof response?.title === 'string' ? response.title.trim() : '';
        if (title) {
            updateConversation(this.conversationId, { title });
            this.publishTitle(title);
        }
    }

    stop(): void {
        for (const session of this.sessions.values()) {
            if (session.answering) {
                session.stop();
            }
        }
    }

    async pause(): Promise<void> {
        this.clearIdlePause();
        this.pausing = true;
        try {
            await Promise.all([...this.sessions.values()].map(session => session.kill()));
            for (const waiting of this.pending.splice(0)) {
                this.deferPending(waiting);
            }
        }
        finally {
            this.pausing = false;
        }
        this.publishStatus();
    }

    private deferPending(waiting: PendingMessage): void {
        const agent = this.reachableAgents().find(candidate => candidate.id === waiting.agentId) ?? leadAgent();
        const session = this.sessionFor(agent);
        const prompt = this.buildPrompt(agent, promptWithAttachments(this.conversationId, waiting.text, waiting.attachments), this.personAuthor(agent, waiting.sender, undefined), null);
        this.addUserMessage(waiting.parts, waiting.sender, session);
        session.defer({ ref: waiting.ref, parts: waiting.parts, createdAt: waiting.createdAt, agentId: agent.id, prompt, sender: waiting.sender } satisfies QueuedPrompt);
    }

    private scheduleIdlePause(): void {
        this.clearIdlePause();
        const sessions = [...this.sessions.values()];
        if (!sessions.some(session => session.running) || this.turnActive || this.runningBackgroundTasks.length > 0) {
            return;
        }
        this.idleTimer = setTimeout(() => {
            this.idleTimer = null;
            void this.pause();
        }, IDLE_PAUSE_MS);
        this.idleTimer.unref();
    }

    private clearIdlePause(): void {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }

    private writeMcpConfig(): string {
        const dir = join(resolveDataDir(), 'mcp');
        mkdirSync(dir, { recursive: true, mode: 0o700 });
        const path = join(dir, `${this.conversationId}.json`);
        const url = `${this.serverOrigin}${useRuntimeConfig().app.baseURL.replace(/\/$/, '')}/api/mcp/${this.conversationId}`;
        const config = { mcpServers: { chat: { type: 'http', url, headers: { Authorization: `Bearer ${this.mcpToken}` } } } };
        writeFileSync(path, JSON.stringify(config), { mode: 0o600 });
        return path;
    }

    private publishStatus(): void {
        const status = [...this.sessions.values()].some(session => session.running) ? 'running' : 'paused';
        this.scheduleIdlePause();
        setConversationStatus(this.conversationId, status);
        publishConversationEvent(this.conversationId, { type: 'status', status, turnActive: this.turnActive, answeringAgentId: this.answeringAgentId, backgroundTasks: this.runningBackgroundTasks, queuedMessages: this.queuedMessages });
        this.publishSummary();
    }

    private publishSummary(): void {
        const conversation = findConversation(this.conversationId);
        if (conversation) {
            publishConversationListEvent({ type: 'conversation', conversation: summarize(conversation) });
        }
    }
}

function messageParts(conversationId: string, text: string, attachments: StoredFile[]): ChatPart[] {
    const parts: ChatPart[] = attachments.map(file => fileUIPart(conversationId, file));
    if (text.trim()) {
        parts.push({ type: 'text', text });
    }
    return parts;
}

function projectWriteRules(projectDir: string): string[] {
    return ['Edit', 'Write', 'NotebookEdit'].map(tool => `${tool}(/${projectDir}/**)`);
}

const runtimes = new Map<string, ConversationRuntime>();

export function useConversationRuntime(conversationId: string): ConversationRuntime {
    const existing = runtimes.get(conversationId);
    if (existing) {
        return existing;
    }
    const runtime = new ConversationRuntime(conversationId);
    runtimes.set(conversationId, runtime);
    return runtime;
}

export function isTurnActive(conversationId: string): boolean {
    return runtimes.get(conversationId)?.turnActive ?? false;
}

export function runningBackgroundTasks(conversationId: string): BackgroundTask[] {
    return runtimes.get(conversationId)?.runningBackgroundTasks ?? [];
}

export function queuedMessages(conversationId: string): QueuedMessage[] {
    return runtimes.get(conversationId)?.queuedMessages ?? [];
}

export async function pauseAllConversations(): Promise<void> {
    await Promise.all([...runtimes.values()].map(runtime => runtime.pause()));
}

export function titleFromPrompt(text: string): string {
    const plain = text
        .split('\n')
        .map(line => line.replace(/^\s*(?:>\s*)*(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)?/, ''))
        .join(' ')
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/(\*\*|__|~~|`+)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return plain.length > TITLE_LENGTH ? `${plain.slice(0, TITLE_LENGTH - 1).trimEnd()}…` : plain || 'New conversation';
}

export function summarize(row: NonNullable<ReturnType<typeof findConversation>>): ConversationSummary {
    return {
        id: row.id,
        title: row.title,
        creatorId: row.creatorId,
        participantIds: conversationParticipantIds(row.id, row.creatorId),
        mutedUserIds: conversationMutedUserIds(row.id),
        lastAnswerAt: row.lastAnswerAt,
        agentIds: conversationAgentIds(row.id),
        status: row.status,
        turnActive: isTurnActive(row.id),
        answeringAgentId: runtimes.get(row.id)?.answeringAgentId ?? null,
        backgroundTasks: runningBackgroundTasks(row.id),
        queuedMessages: queuedMessages(row.id),
        lastActivityAt: row.lastActivityAt,
        archivedAt: row.archivedAt,
    };
}
