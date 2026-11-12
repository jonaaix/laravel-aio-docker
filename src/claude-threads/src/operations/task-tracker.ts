import type { TaskItem } from './types.js';

interface TrackedTask {
  taskId?: string;
  subject: string;
  activeForm?: string;
  status: TaskItem['status'];
  isPlaceholder?: boolean;
}

export interface PersistedTrackedTask {
  taskId: string;
  subject: string;
  activeForm?: string;
  status: TaskItem['status'];
  isPlaceholder?: boolean;
}

const VALID_STATUSES: ReadonlySet<string> = new Set(['pending', 'in_progress', 'completed']);

const CREATED_RESULT_RE = /Task #(\S+) created/;

export class TaskTracker {
  private tasks: TrackedTask[] = [];
  private pendingCreates = new Map<string, TrackedTask>();
  private unmatchedCreateResults = 0;

  create(toolUseId: string, input: Record<string, unknown>): void {
    const task: TrackedTask = {
      subject: typeof input.subject === 'string' ? input.subject : 'Task',
      activeForm: typeof input.activeForm === 'string' ? input.activeForm : undefined,
      status: 'pending',
    };
    this.tasks.push(task);
    if (toolUseId) {
      this.pendingCreates.set(toolUseId, task);
    }
  }

  hasPendingCreate(toolUseId: string): boolean {
    return this.pendingCreates.has(toolUseId);
  }

  resolveCreatedId(
    toolUseId: string,
    resultContent: string,
    isError = false
  ): 'resolved' | 'merged' | 'removed' | 'ignored' {
    const task = this.pendingCreates.get(toolUseId);
    if (!task) return 'ignored';
    this.pendingCreates.delete(toolUseId);
    const match = isError ? null : CREATED_RESULT_RE.exec(resultContent);
    if (!match) {
      if (!isError) this.unmatchedCreateResults++;
      this.tasks = this.tasks.filter(t => t !== task);
      return 'removed';
    }
    const placeholder = this.tasks.find(t => t !== task && t.taskId === match[1]);
    if (placeholder) {
      task.status = placeholder.status;
      if (placeholder.subject !== `Task #${match[1]}`) task.subject = placeholder.subject;
      if (placeholder.activeForm && !task.activeForm) task.activeForm = placeholder.activeForm;
      this.tasks = this.tasks.filter(t => t !== placeholder);
    }
    task.taskId = match[1];
    return placeholder ? 'merged' : 'resolved';
  }

  consumeUnmatchedCreateResultFlag(): boolean {
    if (this.unmatchedCreateResults === 0) return false;
    this.unmatchedCreateResults = 0;
    return true;
  }

  update(input: Record<string, unknown>): boolean {
    const taskId =
      typeof input.taskId === 'string'
        ? input.taskId
        : typeof input.taskId === 'number'
          ? String(input.taskId)
          : undefined;
    if (!taskId) return false;

    let task = this.tasks.find(t => t.taskId === taskId);
    const status = typeof input.status === 'string' ? input.status : undefined;

    if (status === 'deleted') {
      if (!task) return false;
      this.tasks = this.tasks.filter(t => t !== task);
      return true;
    }

    if (!task) {
      task = { taskId, subject: `Task #${taskId}`, status: 'pending', isPlaceholder: true };
      this.tasks.push(task);
    }

    if (typeof input.subject === 'string') task.subject = input.subject;
    if (typeof input.activeForm === 'string') task.activeForm = input.activeForm;
    if (status === 'pending' || status === 'in_progress' || status === 'completed') {
      task.status = status;
    }
    return true;
  }

  toTaskItems(): TaskItem[] {
    return this.tasks.map(t => ({
      content: t.subject,
      status: t.status,
      activeForm: t.activeForm ?? t.subject,
    }));
  }

  get isEmpty(): boolean {
    return this.tasks.length === 0;
  }

  get allCompleted(): boolean {
    return (
      this.tasks.length > 0 &&
      this.tasks.every(t => t.status === 'completed') &&
      this.tasks.some(t => !t.isPlaceholder)
    );
  }

  clear(): void {
    this.tasks = [];
    this.pendingCreates.clear();
    this.unmatchedCreateResults = 0;
  }

  serialize(): PersistedTrackedTask[] | undefined {
    const restorable = this.tasks.filter(
      (t): t is TrackedTask & { taskId: string } => Boolean(t.taskId)
    );
    if (restorable.length === 0) return undefined;
    return restorable.map(t => {
      const out: PersistedTrackedTask = {
        taskId: t.taskId,
        subject: t.subject,
        status: t.status,
      };
      if (t.activeForm) out.activeForm = t.activeForm;
      if (t.isPlaceholder) out.isPlaceholder = true;
      return out;
    });
  }

  restore(state: PersistedTrackedTask[]): void {
    if (!Array.isArray(state)) {
      this.tasks = [];
      this.pendingCreates.clear();
      return;
    }
    this.tasks = state
      .filter((t): t is PersistedTrackedTask =>
        t !== null && typeof t === 'object' &&
        typeof t.taskId === 'string' && t.taskId.length > 0 && typeof t.subject === 'string')
      .map(t => ({
        taskId: t.taskId,
        subject: t.subject || `Task #${t.taskId}`,
        activeForm: typeof t.activeForm === 'string' ? t.activeForm : undefined,
        status: (VALID_STATUSES.has(t.status) ? t.status : 'pending') as TaskItem['status'],
        isPlaceholder: t.isPlaceholder === true ? true : undefined,
      }));
    this.pendingCreates.clear();
  }
}
