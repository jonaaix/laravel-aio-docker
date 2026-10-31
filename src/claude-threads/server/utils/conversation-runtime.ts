import { ClaudeCli, type ClaudeEvent } from '../../src/claude/cli';
import type { ChatPart, ConversationStatus, ConversationSummary } from '../../shared/types/conversation';

const TITLE_LENGTH = 60;

interface ActiveTurn {
  messageId: string | null;
  parts: ChatPart[];
}

class ConversationRuntime {
  private agent: ClaudeCli | null = null;
  private turn: ActiveTurn | null = null;

  constructor(private readonly conversationId: string) {}

  get turnActive(): boolean {
    return this.turn !== null;
  }

  send(text: string): void {
    const conversation = findConversation(this.conversationId);
    if (!conversation) {
      throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });
    }
    const message = appendMessage(this.conversationId, 'user', [{ type: 'text', text }]);
    publishConversationEvent(this.conversationId, { type: 'message', message });
    this.turn = { messageId: null, parts: [] };
    const agent = this.agent ?? this.startAgent(conversation);
    agent.sendMessage(text);
    this.publishStatus('running');
  }

  stop(): void {
    this.agent?.interrupt();
  }

  async pause(): Promise<void> {
    const agent = this.agent;
    if (!agent) {
      return;
    }
    this.agent = null;
    this.turn = null;
    await agent.kill();
    this.publishStatus('paused');
  }

  private startAgent(conversation: NonNullable<ReturnType<typeof findConversation>>): ClaudeCli {
    const agent = new ClaudeCli({
      workingDir: conversation.workingDir,
      sessionId: conversation.agentSessionRef,
      resume: conversation.agentSessionStarted,
      model: useRuntimeConfig().claudeModel || undefined,
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
    if (!this.turn) {
      return;
    }
    if (event.type === 'result') {
      this.finishTurn();
      return;
    }
    const changed = applyClaudeEvent(this.turn.parts, event);
    if (changed.length > 0) {
      this.recordParts(changed);
    }
  }

  private recordParts(changed: number[]): void {
    const turn = this.turn!;
    if (!turn.messageId) {
      const message = appendMessage(this.conversationId, 'assistant', turn.parts);
      turn.messageId = message.id;
      publishConversationEvent(this.conversationId, { type: 'message', message });
      return;
    }
    saveMessageParts(this.conversationId, turn.messageId, turn.parts);
    for (const index of changed) {
      publishConversationEvent(this.conversationId, { type: 'part', messageId: turn.messageId, index, part: turn.parts[index]! });
    }
  }

  private finishTurn(): void {
    this.turn = null;
    this.publishStatus('running');
  }

  private handleExit(agent: ClaudeCli): void {
    if (this.agent !== agent) {
      return;
    }
    this.agent = null;
    this.turn = null;
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

export function summarize(row: { id: string; title: string; status: ConversationStatus; lastActivityAt: number }): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    turnActive: isTurnActive(row.id),
    lastActivityAt: row.lastActivityAt,
  };
}
