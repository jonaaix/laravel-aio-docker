/**
 * realtest — shared post shape + a sleep helper.
 *
 * (The realtest drives an in-process fake Mattermost, so there is no real
 * HTTP client here; `ThreadPost` is the normalized post the scenarios and
 * analysis work with.)
 */
export interface ThreadPost {
  id: string;
  createAt: number;
  userId: string;
  author: string; // username
  message: string;
  rootId: string;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
