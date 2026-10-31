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

### Conversations

A sidebar lists the conversations. Someone can start a new conversation, open an earlier one and
continue it. Each conversation is its own agent session. The agent's answer appears while it is
being written; its tool use and reasoning are visible as separate, quieter blocks next to the
answer rather than mixed into it.

Every conversation keeps its full history — messages, tool activity, and the files and images
exchanged — and comes back complete after a page reload or a container restart.

### Stopping and pausing

There are no chat commands. Two controls replace the ones that mattered:

- **Stop** interrupts the answer currently being produced. The conversation stays open and can
  continue with the next message.
- **Pause** ends the running agent session but keeps the conversation resumable. Sending a new
  message picks the conversation up again.

### Decisions the agent asks for

When the agent needs a permission, asks a question or proposes a plan, the chat shows it as a
prompt with the possible answers as controls. The agent waits until someone answers there.

### Files and images

Files and images the agent sends — screenshots, reports, exports — appear inline in the
conversation and are stored with it. People can attach files to their own messages as well.

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
