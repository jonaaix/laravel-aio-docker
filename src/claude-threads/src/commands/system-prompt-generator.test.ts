/**
 * Tests for the system prompt generator
 */

import { describe, it, expect } from 'bun:test';
import {
  generateChatPlatformPrompt,
  buildSessionContext,
  buildCollaboratorContext,
  buildPeerBotContext,
  resolveCollaborators,
  formatCollaboratorListForChat,
  buildAppendSystemPrompt,
  buildWriteScopeContext,
  buildExpertPeerRoster,
  type ResolvedCollaborator,
} from './system-prompt-generator.js';
import { VERSION } from '../version.js';
import type { PlatformUser } from '../platform/types.js';

describe('generateChatPlatformPrompt', () => {
  it('generates a non-empty prompt', () => {
    const prompt = generateChatPlatformPrompt();

    expect(prompt).toBeTruthy();
    expect(prompt.length).toBeGreaterThan(500);
  });

  it('includes version information', () => {
    const prompt = generateChatPlatformPrompt();

    expect(prompt).toContain('Claude Threads Version:');
    expect(prompt).toContain(VERSION);
  });

  it('includes How This Works section', () => {
    const prompt = generateChatPlatformPrompt();

    expect(prompt).toContain('## How This Works');
    expect(prompt).toContain('Claude Code running as a bot');
  });

  it('keeps the Claude identity for an explicit claude backend', () => {
    const prompt = generateChatPlatformPrompt({ backend: 'claude' });

    expect(prompt).toContain('You are Claude Code running as a bot');
  });

  it('states the configured model instead of the Claude identity for opencode sessions', () => {
    // Regression: the prompt used to claim "You are Claude Code" for every
    // backend, so non-Claude models (DeepSeek/Kimi via opencode) introduced
    // themselves as Claude when users asked which model they are.
    const prompt = generateChatPlatformPrompt({
      backend: 'opencode',
      model: 'openrouter/deepseek/deepseek-v4-pro',
    });

    expect(prompt).not.toContain('You are Claude Code');
    expect(prompt).toContain('`openrouter/deepseek/deepseek-v4-pro`');
  });

  it('avoids the Claude identity for opencode sessions without a configured model', () => {
    const prompt = generateChatPlatformPrompt({ backend: 'opencode' });

    expect(prompt).not.toContain('You are Claude Code');
    expect(prompt).toContain("don't guess");
  });

  it('includes Permissions & Interactions section', () => {
    const prompt = generateChatPlatformPrompt();

    expect(prompt).toContain('## Permissions & Interactions');
    expect(prompt).toContain('Permission requests');
  });

  it('includes User Commands section', () => {
    const prompt = generateChatPlatformPrompt();

    expect(prompt).toContain('## User Commands');
    expect(prompt).toContain('`!stop`');
    expect(prompt).toContain('`!escape`');
    expect(prompt).toContain('`!approve`');
    expect(prompt).toContain('`!invite @user`');
    expect(prompt).toContain('`!kick @user`');
    expect(prompt).toContain('`!cd');
    expect(prompt).toContain('`!permissions');
    expect(prompt).toContain('`!update`');
  });

  it('includes Commands You Can Execute section', () => {
    const prompt = generateChatPlatformPrompt();

    expect(prompt).toContain('## Commands You Can Execute');
    expect(prompt).toContain('`!worktree list`');
    expect(prompt).toContain('`!cd');
  });

  it('includes Commands Claude should NOT use', () => {
    const prompt = generateChatPlatformPrompt();

    expect(prompt).toContain('Commands you should NOT use');
    expect(prompt).toContain('`!stop`');
    expect(prompt).toContain('`!escape`');
  });

  it('warns about !cd spawning new instance', () => {
    const prompt = generateChatPlatformPrompt();

    expect(prompt).toContain('WARNING');
    expect(prompt).toContain("won't remember this conversation");
  });
});

describe('buildSessionContext', () => {
  const mattermostPlatform = {
    platformType: 'mattermost',
    displayName: 'Test Server',
    getThreadLink: (threadId: string) => `https://chat.example.com/_redirect/pl/${threadId}`,
  };

  const slackPlatform = {
    platformType: 'slack',
    displayName: 'Workspace',
    getThreadLink: (threadId: string) => `https://slack.example.com/archives/C123/p${threadId}`,
  };

  it('formats platform and working directory', () => {
    const context = buildSessionContext(mattermostPlatform, '/home/user/project', 'thread-1');

    expect(context).toContain('Platform:');
    expect(context).toContain('Mattermost');
    expect(context).toContain('Test Server');
    expect(context).toContain('Working Directory:');
    expect(context).toContain('/home/user/project');
  });

  it('capitalizes platform type', () => {
    const context = buildSessionContext(slackPlatform, '/path', 'thread-1');

    expect(context).toContain('Slack');
    // The full string still contains lowercase 'slack' inside the URL —
    // assert that the *capitalized* form precedes the URL segment so the
    // intent of the assertion (label, not URL) is preserved.
    const labelSegment = context.split('|')[0];
    expect(labelSegment).toContain('Slack');
    expect(labelSegment).not.toMatch(/\bslack\b/);
  });

  it('includes the Thread permalink so Claude can reference the conversation', () => {
    // Regression-defender: the chat link is what lets Claude paste a
    // back-reference into MR/ticket descriptions it generates. Without
    // this segment that affordance is gone — Claude has no way to know
    // the thread URL.
    const captured: string[] = [];
    const platform = {
      platformType: 'mattermost',
      displayName: 'Team',
      getThreadLink: (threadId: string) => {
        captured.push(threadId);
        return `https://chat.example.com/_redirect/pl/${threadId}`;
      },
    };

    const context = buildSessionContext(platform, '/repo', 'thread-abc');

    expect(captured).toEqual(['thread-abc']);
    expect(context).toContain('**Thread:**');
    expect(context).toContain('https://chat.example.com/_redirect/pl/thread-abc');
  });
});

// ---------------------------------------------------------------------------
// Collaborator co-author attribution
// ---------------------------------------------------------------------------

function fakePlatform(users: Record<string, PlatformUser | null>) {
  return {
    platformType: 'mattermost',
    displayName: 'Test',
    getThreadLink: (id: string) => `https://example.com/${id}`,
    async getUserByUsername(username: string): Promise<PlatformUser | null> {
      return users[username] ?? null;
    },
  };
}

function fakeStore(emails: Record<string, Record<string, string>>) {
  return {
    get(platformId: string, username: string): string | undefined {
      return emails[platformId]?.[username];
    },
  };
}

describe('resolveCollaborators', () => {
  it('returns empty when only the owner is in the set', async () => {
    const platform = fakePlatform({});
    const store = fakeStore({});
    const result = await resolveCollaborators(platform, 'mm', 'alice', ['alice'], store);
    expect(result).toEqual([]);
  });

  it('skips the owner', async () => {
    const platform = fakePlatform({
      bob: { id: 'b', username: 'bob', displayName: 'Bob B' },
    });
    const store = fakeStore({ mm: { bob: '111+bob@users.noreply.github.com' } });
    const result = await resolveCollaborators(platform, 'mm', 'alice', ['alice', 'bob'], store);
    expect(result).toEqual([{ username: 'bob', name: 'Bob B', email: '111+bob@users.noreply.github.com' }]);
  });

  it('skips collaborators without a registered noreply email (privacy)', async () => {
    // We never read the platform email — it would leak to the chat thread
    // and the local Claude history. Bob has no registration → no co-author.
    const platform = fakePlatform({
      bob: { id: 'b', username: 'bob', displayName: 'Bob B', email: 'bob@example.com' },
      carol: { id: 'c', username: 'carol' },
    });
    const store = fakeStore({ mm: { carol: '222+carol@users.noreply.github.com' } });
    const result = await resolveCollaborators(platform, 'mm', 'alice', ['alice', 'bob', 'carol'], store);
    expect(result).toEqual([
      { username: 'carol', name: 'carol', email: '222+carol@users.noreply.github.com' },
    ]);
  });

  it('keeps the user even when the platform display-name lookup fails', async () => {
    // Display name lookup failures are best-effort: we still tag the
    // co-author, falling back to username for the human-readable part.
    const platform = {
      platformType: 'mattermost',
      displayName: 'Test',
      getThreadLink: (id: string) => `https://example.com/${id}`,
      async getUserByUsername(_: string): Promise<PlatformUser | null> {
        throw new Error('flaky API');
      },
    };
    const store = fakeStore({ mm: { carol: '222+carol@users.noreply.github.com' } });
    const result = await resolveCollaborators(platform, 'mm', 'alice', ['alice', 'carol'], store);
    expect(result).toEqual([{ username: 'carol', name: 'carol', email: '222+carol@users.noreply.github.com' }]);
  });

  it('isolates registrations per platform (same username on two platforms)', async () => {
    const platform = fakePlatform({
      bob: { id: 'b', username: 'bob', displayName: 'Bob B' },
    });
    const store = fakeStore({
      mm: { bob: '111+bob@users.noreply.github.com' },
      slack: { bob: '999+bob@users.noreply.github.com' },
    });
    const onMm = await resolveCollaborators(platform, 'mm', 'alice', ['alice', 'bob'], store);
    const onSlack = await resolveCollaborators(platform, 'slack', 'alice', ['alice', 'bob'], store);
    expect(onMm[0].email).toBe('111+bob@users.noreply.github.com');
    expect(onSlack[0].email).toBe('999+bob@users.noreply.github.com');
  });
});

describe('buildCollaboratorContext', () => {
  it('falls back to a single-line standby instruction when there are no collaborators', () => {
    // Solo sessions don't need the full rule yet — but the system prompt still
    // has to teach Claude the "Collaborators updated" thread convention,
    // otherwise a later !invite would post a notice Claude doesn't recognize.
    const section = buildCollaboratorContext([]);
    expect(section).toContain('"Collaborators updated"');
    expect(section).toContain('Co-Authored-By:');
    // Compactness: a few lines, not a full section with header.
    expect(section).not.toContain('## Git commit attribution');
    expect(section.split('\n').length).toBeLessThanOrEqual(2);
  });

  it('lists current collaborators in the Co-Authored-By format', () => {
    const collaborators: ResolvedCollaborator[] = [
      { username: 'bob', name: 'Bob B', email: 'bob@example.com' },
      { username: 'carol', name: 'Carol C', email: 'carol@example.com' },
    ];
    const section = buildCollaboratorContext(collaborators);
    expect(section).toContain('- Bob B <bob@example.com>');
    expect(section).toContain('- Carol C <carol@example.com>');
    expect(section).toContain('supersedes this one');
  });

  it('disambiguates who Claude must not co-author (owner is author, no bot, no AI) — full form', () => {
    // "yourself" was ambiguous — Claude could read it as the bot or as the
    // owner. Spell out both: owner is the implicit author; no bot/AI trailers.
    const section = buildCollaboratorContext([
      { username: 'bob', name: 'Bob', email: 'bob@example.com' },
    ]);
    expect(section).toMatch(/session\s+owner/);
    expect(section).toMatch(/implicit\s+author/);
    expect(section).toContain('the bot');
    expect(section).toContain('AI assistant');
  });

  it('disambiguates the standby one-liner too (same exclusion list)', () => {
    // The empty-state form is shown to solo sessions — it must give the
    // same exclusion guidance, not fall back to ambiguous "yourself".
    const section = buildCollaboratorContext([]);
    expect(section).toMatch(/session\s+owner/);
    expect(section).toMatch(/implicit\s+author/);
    expect(section).toContain('AI assistant');
    expect(section).not.toMatch(/\byourself\b/);
  });
});

describe('formatCollaboratorListForChat', () => {
  it('returns empty string for empty list (caller produces the "no co-authors" sentence)', () => {
    expect(formatCollaboratorListForChat([])).toBe('');
  });

  it('joins names + emails with comma+space', () => {
    const out = formatCollaboratorListForChat([
      { username: 'bob', name: 'Bob B', email: 'bob@x.com' },
      { username: 'carol', name: 'Carol', email: 'c@x.com' },
    ]);
    expect(out).toBe('Bob B <bob@x.com>, Carol <c@x.com>');
  });
});

describe('buildPeerBotContext', () => {
  it('is empty when there are no peer bots (single-bot channel)', () => {
    expect(buildPeerBotContext([])).toBe('');
  });

  it('lists peers and teaches the strict @name handoff rule', () => {
    const section = buildPeerBotContext([{ name: 'peer-bot-2' }]);
    expect(section).toContain('## Other assistants in this thread');
    expect(section).toContain('`@peer-bot-2`');
    // Hardened: warns against bold-wrapping the mention (the observed failure).
    expect(section).toContain('**@peer-bot-2**');
    expect(section.toLowerCase()).toContain('plain text');
    // Reinforces that a plain reply goes to the user (no bot-to-bot loop).
    expect(section.toLowerCase()).toContain('goes to the user');
  });

  it('renders each peer\'s specialization when provided', () => {
    const section = buildPeerBotContext([
      { name: 'analytics-bot', description: 'Mixpanel & product analytics' },
      { name: 'infra-bot', description: 'infra & deploys' },
    ]);
    expect(section).toContain('`@analytics-bot` — Mixpanel & product analytics');
    expect(section).toContain('`@infra-bot` — infra & deploys');
  });

  it('teaches the explicit turn-signal handoff and that a bare mention does NOT hand off', () => {
    const section = buildPeerBotContext([{ name: 'peer-bot-2' }]);
    // Handoff requires the exact sentence, not any mention.
    expect(section).toContain("it's your turn.");
    expect(section.toLowerCase()).toContain('the only thing that passes the turn');
    expect(section.toLowerCase()).toContain('mention peers freely in prose');
  });

  it('allows proactive handoff without requiring explicit user permission', () => {
    const section = buildPeerBotContext([{ name: 'peer-bot-2', description: 'x' }]);
    expect(section.toLowerCase()).toContain('explicit permission');
  });

  it('encourages proactive, sustained consultation of peers on their specialty', () => {
    const section = buildPeerBotContext([{ name: 'peer-bot-2', description: 'x' }]);
    // Regression: the old wording dampened handoffs ("only when it genuinely
    // helps"), so bots consulted too rarely and less over time. Encourage it,
    // and frame it as a standing per-turn check so it doesn't fade on long threads.
    expect(section.toLowerCase()).toContain('proactively consult');
    expect(section.toLowerCase()).toContain('standing check on every turn');
  });

  it('frames the hand-off positively (self-contained message), not by claiming the peer is blind', () => {
    const section = buildPeerBotContext([{ name: 'peer-bot-2', description: 'x' }]);
    // Regression: claiming "the peer can't see this conversation" was untrue —
    // we DO inject a missed-messages catch-up — and a sharp bot called it out.
    // Frame it as a positive directive instead of a (false) visibility claim.
    expect(section.toLowerCase()).toContain('self-contained');
    expect(section.toLowerCase()).not.toContain("can't see");
    expect(section.toLowerCase()).not.toContain('see this conversation');
  });

  it('tells the bot to request a reply size and to keep its own answers tight', () => {
    const section = buildPeerBotContext([{ name: 'peer-bot-2', description: 'x' }]);
    // Regression: peers over-answered; every ask must carry a requested size,
    // and the answering bot must honour it / default to concise.
    expect(section.toLowerCase()).toContain('how much you want back');
    expect(section.toLowerCase()).toContain('honour the size');
  });

  it('allows the turn to pass to a different peer (A→B→C chains), not just back to the caller', () => {
    const section = buildPeerBotContext([{ name: 'peer-bot-2', description: 'x' }]);
    expect(section.toLowerCase()).toContain('a→b→c');
  });
});

describe('buildExpertPeerRoster', () => {
  it('is empty when there are no peers', () => {
    expect(buildExpertPeerRoster([])).toBe('');
  });

  it('renders a compact one-line roster with names + specialties', () => {
    const r = buildExpertPeerRoster([
      { name: 'analytics', description: 'Mixpanel analytics' },
      { name: 'infra', description: 'deploys, CI' },
    ]);
    expect(r).toContain('Expert peers in this thread');
    expect(r).toContain('@analytics (Mixpanel analytics)');
    expect(r).toContain('@infra (deploys, CI)');
    expect(r).toContain("it's your turn.");
    expect(r).toContain('reply size');
    expect(r.split('\n')).toHaveLength(1); // single line — negligible cost
  });

  it('omits the parenthetical when a peer has no description', () => {
    const r = buildExpertPeerRoster([{ name: 'solo' }]);
    expect(r).toContain('@solo');
    expect(r).not.toContain('@solo (');
  });
});

describe('buildWriteScopeContext', () => {
  it('lists workdir + tmp and forbids writing elsewhere; refuses when no chief', () => {
    const s = buildWriteScopeContext('/home/bot/ws');
    expect(s).toContain('/home/bot/ws');
    expect(s).toContain('STRICTLY FORBIDDEN');
    expect(s).toContain('outside your allowed write scope');
    expect(s).not.toContain('@'); // no hand-off target named
  });

  it('directs the bot to hand off to the named chief when one exists', () => {
    const s = buildWriteScopeContext('/home/bot/ws', 'chief');
    expect(s).toContain('`@chief`');
    expect(s).toContain("@chief it's your turn.");
    expect(s).not.toContain('stop and say the target'); // refuse text replaced by hand-off
  });
});

describe('buildAppendSystemPrompt', () => {
  it('injects the peer-bot section only when peerBots is provided', async () => {
    const platform = fakePlatform({});
    const withPeers = await buildAppendSystemPrompt(
      platform, 'mm', '/repo', 't1', 'alice', ['alice'], 'STATIC', fakeStore({}),
      { peerBots: [{ name: 'peer-bot-2' }] },
    );
    expect(withPeers).toContain('## Other assistants in this thread');
    expect(withPeers).toContain('`@peer-bot-2`');

    const withoutPeers = await buildAppendSystemPrompt(
      platform, 'mm', '/repo', 't1', 'alice', ['alice'], 'STATIC', fakeStore({}),
    );
    expect(withoutPeers).not.toContain('## Other assistants in this thread');
  });

  it('still teaches the "Collaborators updated" convention in solo sessions', async () => {
    const platform = fakePlatform({});
    const prompt = await buildAppendSystemPrompt(
      platform,
      'mm',
      '/repo',
      't1',
      'alice',
      ['alice'],
      'STATIC_PROMPT_BODY',
      fakeStore({}),
    );
    expect(prompt).toContain('STATIC_PROMPT_BODY');
    expect(prompt).toContain('"Collaborators updated"');
    expect(prompt).toContain('Co-Authored-By:');
    expect(prompt).not.toContain('## Git commit attribution');
  });

  it('includes resolved collaborators when registered in the store', async () => {
    const platform = fakePlatform({
      bob: { id: 'b', username: 'bob', displayName: 'Bob B' },
    });
    const prompt = await buildAppendSystemPrompt(
      platform,
      'mm',
      '/repo',
      't1',
      'alice',
      ['alice', 'bob'],
      'STATIC',
      fakeStore({ mm: { bob: '111+bob@users.noreply.github.com' } }),
    );
    expect(prompt).toContain('- Bob B <111+bob@users.noreply.github.com>');
  });

  it('injects the write-scope rule only when writeConfined is set', async () => {
    const platform = fakePlatform({});
    const confined = await buildAppendSystemPrompt(
      platform, 'mm', '/home/bot/ws', 't1', 'alice', ['alice'], 'STATIC', fakeStore({}),
      { writeConfined: true },
    );
    expect(confined).toContain('## File write scope (STRICT)');
    expect(confined).toContain('/home/bot/ws');

    const unconfined = await buildAppendSystemPrompt(
      platform, 'mm', '/home/bot/ws', 't1', 'alice', ['alice'], 'STATIC', fakeStore({}),
      { writeConfined: false },
    );
    expect(unconfined).not.toContain('## File write scope');
  });

  it('names an unrestricted peer as the out-of-scope hand-off target', async () => {
    const platform = fakePlatform({});
    const prompt = await buildAppendSystemPrompt(
      platform, 'mm', '/home/bot/ws', 't1', 'alice', ['alice'], 'STATIC', fakeStore({}),
      { writeConfined: true, peerBots: [{ name: 'advisor' }, { name: 'chief', unrestricted: true }] },
    );
    // The confined bot is told to hand off to the unrestricted peer, by name.
    expect(prompt).toContain("hand it to `@chief`");
    expect(prompt).toContain("@chief it's your turn.");
  });

  it('gives the unrestricted bot the write-authority rule when it has confined peers', async () => {
    const platform = fakePlatform({});
    const prompt = await buildAppendSystemPrompt(
      platform, 'mm', '/repo', 't1', 'alice', ['alice'], 'STATIC', fakeStore({}),
      { writeConfined: false, peerBots: [{ name: 'advisor' }] },
    );
    expect(prompt).toContain('## You are the write-authority bot');
    expect(prompt).toContain('do NOT perform the write blindly');
    // It's the chief → NOT the confined write-scope rule, NOT the peer role.
    expect(prompt).not.toContain('## File write scope');
    expect(prompt).not.toContain('## You are a peer contributor');
  });

  it('gives a non-chief bot the symmetric peer-contributor role in a multi-bot thread', async () => {
    const platform = fakePlatform({});
    // A confined bot alongside an unrestricted chief.
    const confined = await buildAppendSystemPrompt(
      platform, 'mm', '/repo', 't1', 'alice', ['alice'], 'STATIC', fakeStore({}),
      { writeConfined: true, peerBots: [{ name: 'chief', unrestricted: true }] },
    );
    expect(confined).toContain('## You are a peer contributor here');
    expect(confined).toContain('## File write scope'); // role + rule, both present
    expect(confined).not.toContain('## You are the write-authority bot');

    // Solo bot (no peers) → no ensemble role heading at all.
    const solo = await buildAppendSystemPrompt(
      platform, 'mm', '/repo', 't1', 'alice', ['alice'], 'STATIC', fakeStore({}),
      { writeConfined: true },
    );
    expect(solo).not.toContain('## You are a peer contributor');
    expect(solo).not.toContain('## You are the write-authority bot');
  });

  it('does NOT give the write-authority rule to a lone unrestricted bot (no confined peers)', async () => {
    const platform = fakePlatform({});
    const solo = await buildAppendSystemPrompt(
      platform, 'mm', '/repo', 't1', 'alice', ['alice'], 'STATIC', fakeStore({}),
      { writeConfined: false },
    );
    expect(solo).not.toContain('## You are the write-authority bot');

    // All-unrestricted peers → still no chief role (nobody hands off to it).
    const allChiefs = await buildAppendSystemPrompt(
      platform, 'mm', '/repo', 't1', 'alice', ['alice'], 'STATIC', fakeStore({}),
      { writeConfined: false, peerBots: [{ name: 'other', unrestricted: true }] },
    );
    expect(allChiefs).not.toContain('## You are the write-authority bot');
  });

  it('omits the session-context line when omitSessionContext is set (worktree respawn case)', async () => {
    const platform = fakePlatform({});
    const prompt = await buildAppendSystemPrompt(
      platform,
      'mm',
      '/repo',
      't1',
      'alice',
      ['alice'],
      'STATIC',
      fakeStore({}),
      { omitSessionContext: true },
    );
    expect(prompt).not.toContain('**Platform:**');
    expect(prompt).not.toContain('**Working Directory:**');
    expect(prompt).toContain('STATIC');
    expect(prompt).toContain('"Collaborators updated"');
  });

  it('survives a legacy persisted session that lacks sessionAllowedUsers entries', async () => {
    const platform = fakePlatform({});
    const prompt = await buildAppendSystemPrompt(
      platform,
      'mm',
      '/repo',
      't1',
      'alice',
      ['alice'],
      'STATIC',
      fakeStore({}),
    );
    expect(prompt).toContain('STATIC');
    expect(prompt).toContain('"Collaborators updated"');
  });

  it('does not leak platform email even when the platform exposes one (privacy)', async () => {
    // Regression-defender: an earlier version read `user.email` from the
    // platform API and put it into Co-Authored-By trailers. That leaked
    // private addresses into the chat thread and into the local Claude
    // conversation history. The store-only path must NEVER tag a user
    // whose entry is absent, regardless of the platform reply.
    const platform = fakePlatform({
      bob: { id: 'b', username: 'bob', displayName: 'Bob B', email: 'bob@private.example.com' },
    });
    const prompt = await buildAppendSystemPrompt(
      platform,
      'mm',
      '/repo',
      't1',
      'alice',
      ['alice', 'bob'],
      'STATIC',
      fakeStore({}), // bob has not registered
    );
    expect(prompt).not.toContain('bob@private.example.com');
    expect(prompt).not.toContain('- Bob B');
  });
});

