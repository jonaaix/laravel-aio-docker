# realtest — real-LLM conversation tests (Jonas)

A **manual, cost-incurring** test harness that drives the *actual* bots on a
live Mattermost with *real* LLMs, then verifies behaviour from the real
artifacts (Mattermost thread + the `claude` session transcripts on disk).

This is deliberately **separate** from `tests/integration/` (which uses a mock
Claude CLI) and from `bun test` — it is never run in CI and it spends tokens.

## What it checks

| Scenario | Command | Verifies |
|----------|---------|----------|
| **01 short** | `bun realtest/run.ts 01` | Two bots hold a short-sentence conversation. Each bot's session received the **correct chat history** (right messages, right order, no duplicates), and we flag **unnecessary token burn** (cold prompt cache / re-sent context). |
| **02 commands** | `bun realtest/run.ts 02` | Drives `stop`, `!escape`, `!pause`, then **resumes** via a normal chat message and lets the bots continue — checking history stays continuous and ordering stays correct across the interruption. |
| **03 race** | `bun realtest/run.ts 03` | Fires several messages **while the model is still generating**, then verifies the bot's session saw them in **send-order** (not shuffled / merged / dropped). |

`bun realtest/run.ts all` runs all three. `bun realtest/run.ts preflight` just
checks the environment.

## How results are derived (no guessing)

- **Chat history + tokens** come from the bot's Claude transcript on disk
  (`~/.claude/projects/<cwd>/<claudeSessionId>.jsonl`). We map thread → session
  via `~/.config/claude-threads/sessions.json`, parse the real per-turn `usage`
  (fresh vs. cache-read tokens) and the user turns the model actually saw.
- **Ordering** comes from the Mattermost thread timeline + the transcript's user
  turns.

## Prerequisites

1. **The bot is running** the code under test: `bun dev` (its IPC control socket
   at `~/.config/claude-threads/control.sock` must exist — preflight checks it).
2. **Two bots share one channel** (already the case in this config:
   `claude_bot_jg` + `jg-bot-2`).
3. **A HUMAN Mattermost token.** The bots ignore each other at receipt — only a
   human @mention starts/continues a session — so the harness must post as a
   real user, not as a bot.

### Getting a Mattermost token

In Mattermost: **Profile picture → Security → Personal Access Tokens → Create**.
If you don't see that option, an admin must enable
*Integrations → Personal Access Tokens*. A regular login **session token** also
works. The token owner must be your own account (not one of the bots).

## Run

```bash
# from the repo root, with `bun dev` already running in another terminal
REALTEST_MM_TOKEN=<your-human-token> bun realtest/run.ts preflight
REALTEST_MM_TOKEN=<your-human-token> bun realtest/run.ts 01
REALTEST_MM_TOKEN=<your-human-token> bun realtest/run.ts all
```

The harness reuses `~/.config/claude-threads/config.yaml` for the server URL,
channel and bot list — only the token comes from the environment.

## Cost

Each scenario holds a real conversation on your configured model (currently
**sonnet** for both bots). Scenario 01 is a handful of short turns; `all` is
larger. Nothing runs automatically.

## Unit tests (free, no LLM)

The analysis logic (transcript parsing, token-burn heuristics, history/ordering
checks) is pure and unit-tested against fixtures:

```bash
bun test realtest/lib/analysis.test.ts
```

## Layout

```
realtest/
  run.ts                     entry point
  lib/
    config.ts                loads config.yaml + REALTEST_MM_TOKEN, validates
    preflight.ts             server-up / MM-reachable / human-token / models
    mm.ts                    tiny Mattermost driver (post as human, read thread)
    sessions.ts              thread → claudeSessionId (from sessions.json)
    transcripts.ts           parse claude JSONL → turns + token usage  (pure)
    tokens.ts                token-burn analysis                        (pure)
    history.ts               chat-history correctness                   (pure)
    ordering.ts              timeline + relative-order checks           (pure)
    analyze-conversation.ts  per-bot report (history + tokens)
    report.ts                console formatting
    analysis.test.ts         unit tests for the pure analysis
  scenarios/
    01-short-conversation.ts
    02-commands-resume.ts
    03-typing-race.ts
```
