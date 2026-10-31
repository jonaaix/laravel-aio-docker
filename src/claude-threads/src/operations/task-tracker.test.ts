import { describe, it, expect, beforeEach } from 'bun:test';
import { TaskTracker } from './task-tracker.js';

describe('TaskTracker', () => {
  let tracker: TaskTracker;

  beforeEach(() => {
    tracker = new TaskTracker();
  });

  it('starts empty', () => {
    expect(tracker.isEmpty).toBe(true);
    expect(tracker.allCompleted).toBe(false);
    expect(tracker.toTaskItems()).toEqual([]);
  });

  it('creates tasks as pending', () => {
    tracker.create('tu-1', { subject: 'do things', description: 'd' });
    expect(tracker.toTaskItems()).toEqual([
      { content: 'do things', status: 'pending', activeForm: 'do things' },
    ]);
  });

  it('resolves the real id from the tool result and applies updates by it', () => {
    tracker.create('tu-1', { subject: 'do things', description: 'd' });
    expect(tracker.resolveCreatedId('tu-1', 'Task #12 created successfully: do things')).toBe('resolved');

    expect(tracker.update({ taskId: '12', status: 'in_progress' })).toBe(true);
    expect(tracker.toTaskItems()[0].status).toBe('in_progress');
  });

  it('ignores results for unknown tool_use ids', () => {
    expect(tracker.resolveCreatedId('nope', 'Task #1 created successfully: x')).toBe('ignored');
  });

  it('removes the task when the create result does not match', () => {
    tracker.create('tu-1', { subject: 'x', description: 'd' });
    expect(tracker.resolveCreatedId('tu-1', 'Some unexpected wording')).toBe('removed');
    expect(tracker.isEmpty).toBe(true);
    expect(tracker.resolveCreatedId('tu-1', 'Task #1 created successfully: x')).toBe('ignored');
  });

  it('removes the task when the create result is an error', () => {
    tracker.create('tu-1', { subject: 'x', description: 'd' });
    expect(tracker.resolveCreatedId('tu-1', 'Task #1 created successfully: x', true)).toBe('removed');
    expect(tracker.isEmpty).toBe(true);
  });

  it('merges a placeholder created by an early update into the resolved task', () => {
    tracker.create('tu-1', { subject: 'real subject', description: 'd' });
    tracker.update({ taskId: '3', status: 'in_progress' });
    expect(tracker.toTaskItems()).toHaveLength(2);

    expect(tracker.resolveCreatedId('tu-1', 'Task #3 created successfully: real subject')).toBe('merged');

    expect(tracker.toTaskItems()).toEqual([
      { content: 'real subject', status: 'in_progress', activeForm: 'real subject' },
    ]);
    tracker.update({ taskId: '3', status: 'completed' });
    expect(tracker.allCompleted).toBe(true);
  });

  it('creates a placeholder for updates to unknown task ids', () => {
    tracker.update({ taskId: '7', status: 'completed' });
    expect(tracker.toTaskItems()).toEqual([
      { content: 'Task #7', status: 'completed', activeForm: 'Task #7' },
    ]);
  });

  it('applies subject and activeForm updates', () => {
    tracker.create('tu-1', { subject: 'old', description: 'd' });
    tracker.resolveCreatedId('tu-1', 'Task #1 created successfully: old');
    tracker.update({ taskId: '1', subject: 'new name', activeForm: 'renaming' });
    expect(tracker.toTaskItems()[0]).toEqual({
      content: 'new name',
      status: 'pending',
      activeForm: 'renaming',
    });
  });

  it('deletes tasks on status deleted', () => {
    tracker.create('tu-1', { subject: 'a', description: 'd' });
    tracker.create('tu-2', { subject: 'b', description: 'd' });
    tracker.resolveCreatedId('tu-1', 'Task #1 created successfully: a');
    tracker.update({ taskId: '1', status: 'deleted' });
    expect(tracker.toTaskItems()).toEqual([
      { content: 'b', status: 'pending', activeForm: 'b' },
    ]);
  });

  it('reports allCompleted only when every task is completed', () => {
    tracker.create('tu-1', { subject: 'a', description: 'd' });
    tracker.create('tu-2', { subject: 'b', description: 'd' });
    tracker.resolveCreatedId('tu-1', 'Task #1 created successfully: a');
    tracker.resolveCreatedId('tu-2', 'Task #2 created successfully: b');

    tracker.update({ taskId: '1', status: 'completed' });
    expect(tracker.allCompleted).toBe(false);
    tracker.update({ taskId: '2', status: 'completed' });
    expect(tracker.allCompleted).toBe(true);
  });

  it('clear() resets everything', () => {
    tracker.create('tu-1', { subject: 'a', description: 'd' });
    tracker.clear();
    expect(tracker.isEmpty).toBe(true);
    expect(tracker.resolveCreatedId('tu-1', 'Task #1 created successfully: a')).toBe('ignored');
  });
});

describe('TaskTracker - round-2 review fixes', () => {
  let tracker: TaskTracker;

  beforeEach(() => {
    tracker = new TaskTracker();
  });

  it('placeholder-only sets never report allCompleted (post-restart safety)', () => {
    tracker.update({ taskId: '5', status: 'completed' });
    expect(tracker.isEmpty).toBe(false);
    expect(tracker.allCompleted).toBe(false);
  });

  it('allCompleted still fires when at least one real task is present', () => {
    tracker.create('tu-1', { subject: 'real', description: 'd' });
    tracker.resolveCreatedId('tu-1', 'Task #7 created successfully: real');
    tracker.update({ taskId: '5', status: 'completed' });
    tracker.update({ taskId: '7', status: 'completed' });
    expect(tracker.allCompleted).toBe(true);
  });

  it('a merged task is a real task for allCompleted purposes', () => {
    tracker.update({ taskId: '3', status: 'completed' });
    tracker.create('tu-1', { subject: 'real', description: 'd' });
    expect(tracker.resolveCreatedId('tu-1', 'Task #3 created successfully: real')).toBe('merged');
    expect(tracker.allCompleted).toBe(true);
  });

  it('adopts a placeholder subject rename during merge', () => {
    tracker.create('tu-1', { subject: 'original name', description: 'd' });
    tracker.update({ taskId: '3', subject: 'renamed by update', status: 'in_progress' });
    tracker.resolveCreatedId('tu-1', 'Task #3 created successfully: original name');
    expect(tracker.toTaskItems()).toEqual([
      { content: 'renamed by update', status: 'in_progress', activeForm: 'renamed by update' },
    ]);
  });

  it('accepts a numeric taskId (coerced to string)', () => {
    tracker.create('tu-1', { subject: 'x', description: 'd' });
    tracker.resolveCreatedId('tu-1', 'Task #1 created successfully: x');
    expect(tracker.update({ taskId: 1, status: 'completed' })).toBe(true);
    expect(tracker.toTaskItems()[0].status).toBe('completed');
  });

  it('hasPendingCreate reflects the pending window', () => {
    expect(tracker.hasPendingCreate('tu-1')).toBe(false);
    tracker.create('tu-1', { subject: 'x', description: 'd' });
    expect(tracker.hasPendingCreate('tu-1')).toBe(true);
    tracker.resolveCreatedId('tu-1', 'Task #1 created successfully: x');
    expect(tracker.hasPendingCreate('tu-1')).toBe(false);
  });

  it('flags unmatched non-error create results once, resetting on read', () => {
    tracker.create('tu-1', { subject: 'x', description: 'd' });
    tracker.resolveCreatedId('tu-1', 'Reworded: task recorded');
    expect(tracker.consumeUnmatchedCreateResultFlag()).toBe(true);
    expect(tracker.consumeUnmatchedCreateResultFlag()).toBe(false);
    tracker.create('tu-2', { subject: 'y', description: 'd' });
    tracker.resolveCreatedId('tu-2', 'boom', true);
    expect(tracker.consumeUnmatchedCreateResultFlag()).toBe(false);
  });
});

describe('TaskTracker persistence (serialize/restore)', () => {
  let tracker: TaskTracker;
  beforeEach(() => { tracker = new TaskTracker(); });

  it('serializes resolved tasks and drops in-flight creates', () => {
    tracker.create('tu-1', { subject: 'Migrate schema', activeForm: 'Migrating schema' });
    tracker.resolveCreatedId('tu-1', 'Task #7 created successfully: Migrate schema');
    tracker.update({ taskId: '7', status: 'in_progress' });
    tracker.create('tu-2', { subject: 'Never resolved' });

    const state = tracker.serialize();
    expect(state).toEqual([
      { taskId: '7', subject: 'Migrate schema', activeForm: 'Migrating schema', status: 'in_progress' },
    ]);
  });

  it('serializes placeholders with their flag intact', () => {
    tracker.update({ taskId: '3', status: 'in_progress' });
    expect(tracker.serialize()).toEqual([
      { taskId: '3', subject: 'Task #3', status: 'in_progress', isPlaceholder: true },
    ]);
  });

  it('returns undefined when nothing is restorable', () => {
    expect(tracker.serialize()).toBeUndefined();
    tracker.create('tu-1', { subject: 'pending only' });
    expect(tracker.serialize()).toBeUndefined();
  });

  it('restore brings tasks back so updates keep their real names', () => {
    tracker.restore([
      { taskId: '7', subject: 'Migrate schema', status: 'in_progress' },
      { taskId: '8', subject: 'Write docs', status: 'pending' },
    ]);
    tracker.update({ taskId: '7', status: 'completed' });

    const items = tracker.toTaskItems();
    expect(items).toEqual([
      { content: 'Migrate schema', status: 'completed', activeForm: 'Migrate schema' },
      { content: 'Write docs', status: 'pending', activeForm: 'Write docs' },
    ]);
  });

  it('restored real tasks count toward allCompleted', () => {
    tracker.restore([
      { taskId: '7', subject: 'Migrate schema', status: 'in_progress' },
    ]);
    tracker.update({ taskId: '7', status: 'completed' });
    expect(tracker.allCompleted).toBe(true);
  });

  it('restored placeholders still do not signal completion alone', () => {
    tracker.restore([
      { taskId: '3', subject: 'Task #3', status: 'completed', isPlaceholder: true },
    ]);
    expect(tracker.allCompleted).toBe(false);
  });

  it('restore tolerates malformed entries', () => {
    tracker.restore([
      { taskId: '1', subject: 'Good', status: 'pending' },
      { taskId: '', subject: 'no id', status: 'pending' },
      { taskId: '2', subject: '', status: 'bogus-status' } as never,
    ]);
    const items = tracker.toTaskItems();
    expect(items[0]).toEqual({ content: 'Good', status: 'pending', activeForm: 'Good' });
    expect(items.length).toBeLessThanOrEqual(2);
  });

  it('restore tolerates null/primitive entries in the array (corrupt row must not abort resume)', () => {
    tracker.restore([
      null,
      'junk',
      42,
      { taskId: '1', subject: 'Real task', status: 'in_progress' },
    ] as never);
    expect(tracker.toTaskItems()).toEqual([
      { content: 'Real task', status: 'in_progress', activeForm: 'Real task' },
    ]);
  });

  it('restore tolerates a non-array value entirely (resets to empty, never throws)', () => {
    tracker.create('tu-1', { subject: 'Old' });
    tracker.resolveCreatedId('tu-1', 'Task #1 created successfully: Old');
    tracker.restore('garbage-not-an-array' as never);
    expect(tracker.isEmpty).toBe(true);
  });
});
