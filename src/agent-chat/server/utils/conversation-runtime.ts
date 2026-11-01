import { ClaudeCli, type ClaudeEvent } from '#claude-threads/claude/cli';
import type { ChatMessage, ChatPart, ConversationStatus, ConversationSummary } from '../../shared/types/conversation';
import { metricsFromResult, outcomeOnlyMetrics, type TurnMetrics } from './turn-metrics';

const TITLE_LENGTH = 60;
// Questions and plans happen as plain chat text; the chat has no controls for these tools.
const DISALLOWED_TOOLS = ['AskUserQuestion', 'EnterPlanMode', 'ExitPlanMode'];

interface ActiveTurn {
    message: ChatMessage | null;
    parts: ChatPart[];
    liveIndex: number | null;
    stopRequested: boolean;
}

class ConversationRuntime {
    private agent: ClaudeCli | null = null;
    private turn: ActiveTurn | null = null;
    private model: string | null = null;

    constructor(private readonly conversationId: string) {}

    get turnActive(): boolean {
        return this.turn !== null;
    }

    send(text: string): void {
        const conversation = findConversation(this.conversationId);
        if (!conversation) {
            throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });
        }
        if (conversation.archivedAt !== null) {
            throw createError({ statusCode: 409, statusMessage: 'Conversation is archived' });
        }
        const message = appendMessage(this.conversationId, 'user', [{ type: 'text', text }]);
        publishConversationEvent(this.conversationId, { type: 'message', message });
        this.turn = { message: null, parts: [], liveIndex: null, stopRequested: false };
        const agent = this.agent ?? this.startAgent(conversation);
        agent.sendMessage(text);
        this.publishStatus('running');
    }

    stop(): void {
        if (this.turn) {
            this.turn.stopRequested = true;
        }
        this.agent?.interrupt();
    }

    async pause(): Promise<void> {
        const agent = this.agent;
        if (!agent) {
            return;
        }
        this.agent = null;
        this.endTurn(outcomeOnlyMetrics('stopped', this.model));
        await agent.kill();
        this.publishStatus('paused');
    }

    private startAgent(conversation: NonNullable<ReturnType<typeof findConversation>>): ClaudeCli {
        const agent = new ClaudeCli({
            workingDir: conversation.workingDir,
            sessionId: conversation.agentSessionRef,
            resume: conversation.agentSessionStarted,
            model: useRuntimeConfig().claudeModel || undefined,
            includePartialMessages: true,
            thinkingDisplay: 'summarized',
            disallowedTools: DISALLOWED_TOOLS,
            // Bypass until permission prompts are answered in the chat; the container is the sandbox.
            permissionMode: 'bypass',
        });
        agent.on('event', event => this.handleEvent(event));
        agent.on('exit', () => this.handleExit(agent));
        agent.on('error', error => publishConversationEvent(this.conversationId, { type: 'error', message: error.message }));
        agent.start();
        updateConversation(this.conversationId, { agentSessionStarted: true });
        this.agent = agent;
        return agent;
    }

    private handleEvent(event: ClaudeEvent): void {
        if (event.type === 'system' && event.subtype === 'init' && typeof event.model === 'string') {
            this.model = event.model;
        }
        if (event.type === 'rate_limit_event') {
            recordRateLimit(event.rate_limit_info);
        }
        if (!this.turn) {
            return;
        }
        if (event.type === 'result') {
            this.endTurn(metricsFromResult(event, this.model, this.turn.stopRequested));
            this.publishStatus('running');
            return;
        }
        if (event.type === 'stream_event') {
            this.handleStreamEvent(event);
            return;
        }
        const replacesLivePart = event.type === 'assistant' && this.dropLivePart();
        const changed = applyClaudeEvent(this.turn.parts, event);
        if (replacesLivePart) {
            this.saveAndPublishMessage();
            return;
        }
        if (changed.length > 0) {
            this.recordParts(changed);
        }
    }

    private handleStreamEvent(event: ClaudeEvent): void {
        const turn = this.turn!;
        const startPart = streamStartPart(event);
        if (startPart) {
            turn.liveIndex = turn.parts.push(startPart) - 1;
            this.recordParts([turn.liveIndex]);
            return;
        }
        const text = streamDeltaText(event);
        const live = turn.liveIndex === null ? undefined : turn.parts[turn.liveIndex];
        if (!text || !turn.message || !live || (live.type !== 'text' && live.type !== 'reasoning')) {
            return;
        }
        live.text += text;
        publishConversationEvent(this.conversationId, { type: 'delta', messageId: turn.message.id, index: turn.liveIndex!, text });
    }

    private dropLivePart(): boolean {
        const turn = this.turn!;
        if (turn.liveIndex === null) {
            return false;
        }
        turn.parts.splice(turn.liveIndex, 1);
        turn.liveIndex = null;
        return true;
    }

    private settleLivePart(): void {
        const turn = this.turn!;
        const live = turn.liveIndex === null ? undefined : turn.parts[turn.liveIndex];
        if (!live) {
            return;
        }
        if ((live.type === 'text' || live.type === 'reasoning') && live.text.trim()) {
            turn.parts[turn.liveIndex!] = { ...live, state: 'done' };
            turn.liveIndex = null;
        }
        else {
            this.dropLivePart();
        }
        this.saveAndPublishMessage();
    }

    private persistedParts(): ChatPart[] {
        const turn = this.turn!;
        return turn.parts.filter((_, index) => index !== turn.liveIndex);
    }

    private createMessage(): void {
        const turn = this.turn!;
        turn.message = appendMessage(this.conversationId, 'assistant', this.persistedParts());
        this.publishMessage();
    }

    private publishMessage(): void {
        const turn = this.turn!;
        publishConversationEvent(this.conversationId, { type: 'message', message: { ...turn.message!, parts: [...turn.parts] } });
    }

    private saveAndPublishMessage(): void {
        const turn = this.turn!;
        if (!turn.message) {
            if (turn.parts.length > 0) {
                this.createMessage();
            }
            return;
        }
        saveMessageParts(this.conversationId, turn.message.id, this.persistedParts());
        this.publishMessage();
    }

    private recordParts(changed: number[]): void {
        const turn = this.turn!;
        if (!turn.message) {
            this.createMessage();
            return;
        }
        saveMessageParts(this.conversationId, turn.message.id, this.persistedParts());
        for (const index of changed) {
            publishConversationEvent(this.conversationId, { type: 'part', messageId: turn.message.id, index, part: turn.parts[index]! });
        }
    }

    private endTurn(metrics: TurnMetrics): void {
        const turn = this.turn;
        if (!turn) {
            return;
        }
        this.settleLivePart();
        this.turn = null;
        const message = turn.message ?? appendMessage(this.conversationId, 'assistant', []);
        saveTurnMetrics(this.conversationId, message.id, metrics);
        const metadata = { ...message.metadata!, outcome: metrics.outcome, error: metrics.errorMessage ?? undefined };
        publishConversationEvent(this.conversationId, { type: 'message', message: { ...message, parts: [...turn.parts], metadata } });
    }

    private handleExit(agent: ClaudeCli): void {
        if (this.agent !== agent) {
            return;
        }
        this.agent = null;
        this.endTurn(outcomeOnlyMetrics('failed', this.model, 'Claude exited unexpectedly.'));
        this.publishStatus('paused');
    }

    private publishStatus(status: ConversationStatus): void {
        setConversationStatus(this.conversationId, status);
        publishConversationEvent(this.conversationId, { type: 'status', status, turnActive: this.turnActive });
        const conversation = findConversation(this.conversationId);
        if (conversation) {
            publishConversationListEvent({ type: 'conversation', conversation: summarize(conversation) });
        }
    }
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

export async function pauseAllConversations(): Promise<void> {
    await Promise.all([...runtimes.values()].map(runtime => runtime.pause()));
}

export function titleFromPrompt(text: string): string {
    const line = text.trim().split('\n')[0] ?? '';
    return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1)}…` : line || 'New conversation';
}

export function summarize(row: Omit<ConversationSummary, 'turnActive'>): ConversationSummary {
    return {
        id: row.id,
        title: row.title,
        status: row.status,
        turnActive: isTurnActive(row.id),
        lastActivityAt: row.lastActivityAt,
        archivedAt: row.archivedAt,
    };
}
