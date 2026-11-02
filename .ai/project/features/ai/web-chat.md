---
id: ai-web-chat
created: 2026-10-31
tags: [ai-agent, claude-threads, chat, embedding]
---

# AI web chat

## What is it for?

The `fpm-claude-beta` image lets people work with the AI agents running inside the container
through a chat in the browser, the way they would use Claude.ai or ChatGPT. It replaces the
earlier route through Mattermost or Slack: the image brings its own chat, keeps its own history
and needs no external chat platform.

Claude Code is the primary agent. Other backends, such as opencode, and several bots sharing one
conversation remain part of the feature; Claude comes first.

## How does it work?

### Reaching the chat

The chat can be embedded as an iframe inside the Laravel app the container hosts, so the app's
users talk to the agent without leaving the app. Optionally the chat can also be given its own
domain or port, which makes it reachable independently of that app — including when the app
itself is broken.

Inside the Laravel app, the app opens the chat through a short-lived signed link that tells the
chat who the user is. Access through the chat's own domain or port is protected by a password.

### Conversations

A sidebar lists the conversations. Each user sees only their own. A new conversation is named
after the beginning of its first message. When the user sends the third message, the agent titles
the session from the user's first three messages, the way Claude Code titles its terminal sessions;
that title replaces the name in the chat and also names the session in Claude Code's own history.
Conversations that were already past their third message keep their name. The user can rename a
conversation at any time by editing its title in place. A name the user gave is kept: no title is
generated for that conversation anymore, and the name also reaches Claude Code's session history —
right away while the session runs, otherwise when it resumes. Someone can start a new
conversation, open an earlier one and continue it. A conversation that is no longer needed can be
archived: its agent session is paused first, it leaves the sidebar, and the user lands on a new
conversation. It stays stored and can be brought back. Each conversation is its own agent session. The agent's answer appears while it is
being written; its tool use and reasoning are visible as separate, quieter blocks next to the
answer rather than mixed into it.

Any message can be copied with one click. To comment on specific passages, the user selects text
in the conversation and quotes it: the passage lands in the message input as a quote with the
cursor below it, ready for a comment. Quoting again appends the next passage below what is already
written, so several quoted remarks can be collected in one message. Quotes look like quotes while
writing, and the user's sent messages are formatted like the agent's answers; in both, every line
break shows as written, the way Claude Code's terminal shows it. A very long sent
message is shown collapsed to its beginning and can be expanded and collapsed again; it starts
collapsed whenever the conversation is opened. Copying always takes the whole message.

Every conversation keeps its full history — messages, tool activity, and the files and images
exchanged — and comes back complete after a page reload or a container restart.

The history is kept permanently and never cleaned up automatically, so the whole development
process behind an app can be evaluated once the app is finished. For each tool call the history
keeps the call itself in full — including every change made to a file — whether it succeeded, and
the beginning of its output, enough to see why a call failed. Each answer also records the model,
token usage, cost, duration and whether it finished, was stopped or failed.

### Stopping and pausing

There are no chat commands. Two controls replace the ones that mattered:

- **Stop** interrupts the answer currently being produced. The conversation stays open and can
  continue with the next message.
- **Pause** ends the running agent session but keeps the conversation resumable. Sending a new
  message picks the conversation up again.

While the agent is answering, the user can keep writing. With an empty message input the send
button stops the answer; once something is typed, it sends. A message sent during an answer does
not interrupt it: it waits in a queue shown above the message input, and the agent takes it up at
its next step, the way Claude Code does. At that moment the message moves into the conversation and
the agent's answer continues below it. A message still queued when an answer ends or is stopped is
answered next. If the session is paused before the agent took up a queued message, the message
moves into the conversation and is answered when the conversation continues.

A session also pauses on its own after 30 minutes without any activity. Work never counts as
inactivity: while the agent is answering or a task it started in the background is still running,
the session stays online however long that takes. The sidebar marks every conversation whose
session is online.

While tasks the agent started in the background are running, a box pinned above the message input
always lists them, each with its description and how long it has been running. When such a task
finishes and the agent reports back on its own, that report appears and is stored like any other
answer.

### Questions, plans and permissions

The agent works without asking for permission: it runs commands and changes files on its own, so a
task is never held up by approval prompts. When it has a question or proposes a plan, it says so in
its reply, and the user answers with the next message.

Sections the agent marks off with bars — a bar, a title such as "🎯 Plan", another bar — appear
as plain headings with a fine line above them; the bars themselves are not shown. A summary section
("🔑") and a next-step section ("🚀") stand out as cards in the same look as the question card. In
the latest answer the next-step card offers to accept the suggestion: it writes "ok" at the start of
the message input, the same way choosing an option does, and nothing is sent until the user sends.

When an answer contains a questions section — a "❓" heading between two bars, numbered questions,
each with lettered options (`a)`, `b)`, …) or a hint for a free answer, and a closing bar — the
chat shows that section as a question card of its own instead of the raw text: every question with
its full text, its options as selectable rows, the recommended one marked. In the latest answer the
options can be chosen: choosing writes their short form, such as "44 a, 45 b", at the start of the
message input; choosing again changes it without touching what the user wrote below. The card
always shows what that first line says: editing or deleting it changes the chosen options too. One control
picks every recommended option at once. Nothing is sent until the user sends the message, and the
agent learns nothing about the card: it only reads the answer the agent already wrote. Cards in
earlier answers stay visible but can no longer be chosen from.

### Files and images

Files and images the agent sends — screenshots, reports, exports — appear inline in the
conversation and are stored with it. People can attach files of any type to their own messages as
well — by picking them, dropping them onto the chat or pasting them — up to 2 GB each; a message may
consist of attachments only. Attached files are stored with the conversation and shown in the sent
message the same way as the agent's. The agent never receives their content inline: it gets the
list of saved paths ahead of the message text and reads the files itself.

### Several bots in one conversation

Several bots can take part in one conversation. One of them answers at a time; addressing
another bot hands the turn over to it, and a bot that joins catches up on what it missed.

### Not part of the chat

Git worktree handling from the Mattermost bridge is not available in the chat.

## Examples

- A developer opens the admin area of their Laravel app, where the chat sits in an iframe, and
  asks Claude to fix a failing page. Claude takes a screenshot of the result; the screenshot
  shows up inline in the conversation.
- Claude starts down the wrong path. The user presses Stop, the answer halts, and the user sends
  a corrected instruction in the same conversation.
- At the end of the day the user pauses a conversation. The next morning, after the container
  was restarted, they open it again, see the full history including yesterday's screenshots, and
  continue by sending a message.
- The Laravel app is down after a failed deployment. The user opens the chat on its own port and
  asks the agent to investigate.
