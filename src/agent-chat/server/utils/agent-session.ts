import { join } from 'node:path';
import { ClaudeCli, type ClaudeEvent } from '#claude-threads/claude/cli';
import type { BackgroundTask, ChatMessage, ChatPart, QueuedMessage, TurnFileChanges, TurnOutcome } from '../../shared/types/conversation';
import { metricsFromResult, outcomeOnlyMetrics, type TurnMetrics } from './turn-metrics';
import type { UserRow } from './user-store';
import { ChangeTracker } from './working-tree';

const TURN_EVENT_TYPES = new Set(['stream_event', 'assistant', 'user']);
// Questions and plans happen as plain chat text; the chat has no controls for these tools.
const DISALLOWED_TOOLS = ['AskUserQuestion', 'EnterPlanMode', 'ExitPlanMode'];
const READ_ONLY_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch', 'ToolSearch', 'TodoWrite', 'Skill', 'Monitor', 'BashOutput', 'TaskOutput', 'ListMcpResourcesTool', 'ReadMcpResourceTool', 'mcp__chat__send_file', 'mcp__chat__show_page', 'mcp__chat__ask_variants', 'mcp__chat__ask_choice', 'mcp__chat__show_cards']);

interface ActiveTurn {
    message: ChatMessage | null;
    parts: ChatPart[];
    liveIndex: number | null;
    stopRequested: boolean;
}

export interface QueuedPrompt extends QueuedMessage {
    prompt: string;
    sender: UserRow | null;
}

export interface AgentLaunch {
    workingDir: string;
    sessionRef: string;
    resume: boolean;
    model: string | undefined;
    effort: string | undefined;
    appendSystemPrompt: string;
    deniedTools: string[];
    mcpConfigPath: string;
    account: ClaudeAccountFolder;
}

export interface AgentSessionHooks {
    userMessage(session: AgentSession, queued: QueuedPrompt): void;
    turnEnded(session: AgentSession, message: ChatMessage | null, outcome: TurnOutcome): void;
    controlResponse(event: ClaudeEvent): void;
    changed(): void;
    exited(): void;
}

export class AgentSession {
    private cli: ClaudeCli | null = null;
    private accountId = MAIN_ACCOUNT_ID;
    private turn: ActiveTurn | null = null;
    private model: string | null = null;
    private workingDir: string | null = null;
    private queue: QueuedPrompt[] = [];
    private undelivered: QueuedPrompt[] = [];
    private tasks: BackgroundTask[] = [];
    private changes: ChangeTracker | null = null;
    private changesShownIn: string | null = null;

    constructor(
        private readonly conversationId: string,
        readonly agentId: string,
        private readonly hooks: AgentSessionHooks,
    ) {}

    get onAccount(): string | null {
        return this.cli ? this.accountId : null;
    }

    get running(): boolean {
        return this.cli !== null;
    }

    get answering(): boolean {
        return this.turn !== null;
    }

    get turnActive(): boolean {
        return this.turn !== null || this.queue.length > 0;
    }

    get queuedMessages(): QueuedMessage[] {
        return this.queue.map(({ ref, parts, createdAt, agentId }) => ({ ref, parts, createdAt, agentId }));
    }

    get backgroundTasks(): BackgroundTask[] {
        return this.tasks;
    }

    get lastQueuedSenderId(): string | null | undefined {
        return this.queue.length > 0 ? this.queue.at(-1)!.sender?.id ?? null : undefined;
    }

    start(launch: AgentLaunch): void {
        this.accountId = launch.account.id;
        const cli = new ClaudeCli({
            workingDir: launch.workingDir,
            sessionId: launch.sessionRef,
            resume: launch.resume,
            model: launch.model,
            effort: launch.effort,
            includePartialMessages: true,
            replayUserMessages: true,
            thinkingDisplay: 'summarized',
            disallowedTools: [...DISALLOWED_TOOLS, ...launch.deniedTools],
            mcpConfigPath: launch.mcpConfigPath,
            appendSystemPrompt: launch.appendSystemPrompt,
            // Deliberately no permission prompts so work is never held up; the container is the sandbox.
            permissionMode: 'bypass',
            account: launch.account.configDir ? { id: launch.account.id, configDir: launch.account.configDir } : undefined,
        });
        cli.on('event', event => this.handleEvent(event));
        cli.on('exit', () => this.handleExit(cli));
        cli.on('error', error => publishConversationEvent(this.conversationId, { type: 'error', message: error.message }));
        cli.start();
        for (const queued of this.undelivered.splice(0)) {
            cli.sendMessage(queued.prompt);
        }
        this.workingDir = launch.workingDir;
        this.changes = new ChangeTracker(launch.workingDir, join(resolveDataDir(), 'git-index', `${this.conversationId}-${this.agentId}`), shadowGitBase());
        this.cli = cli;
    }

    deliver(prompt: string): void {
        this.beginTurn();
        this.cli!.sendMessage(prompt);
    }

    enqueue(queued: QueuedPrompt): void {
        this.queue.push(queued);
        this.cli!.sendMessage(queued.prompt, queued.ref);
    }

    defer(queued: QueuedPrompt): void {
        this.undelivered.push(queued);
    }

    sendControlRequest(request: Record<string, unknown>): string | null {
        return this.cli?.sendControlRequest(request) ?? null;
    }

    attachPart(create: (workingDir: string) => ChatPart): void {
        if (!this.turn || !this.workingDir) {
            throw new Error('This only works while answering.');
        }
        const part = create(this.workingDir);
        const index = this.turn.parts.push(part) - 1;
        this.recordParts([index]);
    }

    stop(): void {
        if (this.turn) {
            this.turn.stopRequested = true;
        }
        this.cli?.interrupt();
    }

    async kill(): Promise<void> {
        const cli = this.cli;
        if (!cli) {
            return;
        }
        this.cli = null;
        this.tasks = [];
        this.endTurn(outcomeOnlyMetrics('stopped', this.model));
        this.deferQueue();
        this.changes?.dispose();
        await cli.kill();
    }

    private deferQueue(): void {
        for (const queued of this.queue.splice(0)) {
            this.hooks.userMessage(this, queued);
            this.undelivered.push(queued);
        }
    }

    private takeQueued(ref: unknown): void {
        const index = this.queue.findIndex(queued => queued.ref === ref);
        if (index === -1) {
            return;
        }
        const [queued] = this.queue.splice(index, 1);
        this.closeAnswerBlock();
        this.hooks.userMessage(this, queued!);
        this.hooks.changed();
    }

    private closeAnswerBlock(): void {
        const turn = this.turn;
        if (!turn?.message) {
            return;
        }
        this.settleLivePart();
        turn.message = null;
        turn.parts = [];
        turn.liveIndex = null;
    }

    private beginTurn(): void {
        this.turn = { message: null, parts: [], liveIndex: null, stopRequested: false };
        this.changes?.beginTurn();
    }

    private trackBackgroundTasks(tasks: unknown[]): void {
        this.tasks = tasks.map((task) => {
            const { task_id: taskId, description } = task as { task_id?: unknown; description?: unknown };
            const id = String(taskId);
            return this.tasks.find(known => known.id === id) ?? {
                id,
                description: typeof description === 'string' && description.trim() ? description.trim() : 'Background task',
                startedAt: Date.now(),
            };
        });
        this.hooks.changed();
    }

    private handleEvent(event: ClaudeEvent): void {
        if (event.type === 'control_response') {
            this.hooks.controlResponse(event);
            return;
        }
        if (event.type === 'system' && event.subtype === 'background_tasks_changed' && Array.isArray(event.tasks)) {
            this.trackBackgroundTasks(event.tasks);
        }
        if (!this.turn && this.cli && TURN_EVENT_TYPES.has(event.type)) {
            this.beginTurn();
            this.hooks.changed();
        }
        if (event.type === 'system' && event.subtype === 'init' && typeof event.model === 'string') {
            this.model = event.model;
        }
        if (event.type === 'rate_limit_event') {
            recordRateLimit(event.rate_limit_info, this.accountId);
        }
        if (event.type === 'user' && event.isReplay) {
            this.takeQueued(event.uuid);
            return;
        }
        if (!this.turn) {
            return;
        }
        if (event.type === 'result') {
            this.endTurn(metricsFromResult(event, this.model, this.turn.stopRequested));
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
        if (event.type === 'user') {
            this.trackStepChanges(changed);
        }
    }

    private trackStepChanges(changed: number[]): void {
        const turn = this.turn!;
        const messageId = turn.message?.id;
        const mayChangeFiles = changed.some((index) => {
            const part = turn.parts[index];
            return part?.type === 'dynamic-tool' && !READ_ONLY_TOOLS.has(part.toolName);
        });
        if (messageId && mayChangeFiles) {
            this.changes?.afterStep(changes => this.showTurnChanges(messageId, changes));
        }
    }

    private trackTurnChanges(messageId: string | null): void {
        this.changes?.endTurn((changes: TurnFileChanges) => {
            if (messageId && (changes.files.length > 0 || (changes.commits?.length ?? 0) > 0 || this.changesShownIn === messageId)) {
                this.showTurnChanges(messageId, changes);
            }
            this.changesShownIn = null;
        });
    }

    private showTurnChanges(messageId: string, changes: TurnFileChanges): void {
        const part: ChatPart = { type: 'data-turn-changes', data: changes };
        this.changesShownIn = messageId;
        const turn = this.turn;
        if (turn?.message?.id === messageId) {
            const existing = turn.parts.findIndex(candidate => candidate.type === part.type);
            const index = existing === -1 ? turn.parts.push(part) - 1 : existing;
            turn.parts[index] = part;
            this.recordParts([index]);
            return;
        }
        const index = putMessagePart(this.conversationId, messageId, part);
        if (index !== null) {
            publishConversationEvent(this.conversationId, { type: 'part', messageId, index, part });
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
        turn.message = appendMessage(this.conversationId, 'assistant', this.persistedParts(), this.agentId);
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
        const message = turn.message ?? appendMessage(this.conversationId, 'assistant', [], this.agentId);
        saveTurnMetrics(this.conversationId, message.id, metrics);
        if (metrics.outcome !== 'stopped') {
            recordTurnLimit(metrics.outcome === 'failed' ? metrics.errorMessage ?? null : null, this.accountId);
        }
        const finished = { ...message, parts: [...turn.parts], metadata: { ...message.metadata!, outcome: metrics.outcome, error: metrics.errorMessage ?? undefined } };
        publishConversationEvent(this.conversationId, { type: 'message', message: finished });
        this.trackTurnChanges(turn.message ? message.id : null);
        this.hooks.turnEnded(this, turn.message ? finished : null, turn.stopRequested ? 'stopped' : metrics.outcome);
    }

    private handleExit(cli: ClaudeCli): void {
        if (this.cli !== cli) {
            return;
        }
        this.cli = null;
        this.tasks = [];
        this.endTurn(outcomeOnlyMetrics('failed', this.model, 'Claude exited unexpectedly.'));
        this.deferQueue();
        this.changes?.dispose();
        this.hooks.exited();
    }
}
