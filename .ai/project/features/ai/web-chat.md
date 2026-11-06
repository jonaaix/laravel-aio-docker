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
users talk to the agent without leaving the app, or be given its own domain or port.

For working on the app, the chat can also sit beside the pages the app chooses in its own code: a pill "Open AI chat" at the bottom right
— a light, faintly tinted surface inside a slowly flowing gradient border, with gradient lettering and sparkles that turn and glow
under the pointer, in colours the app can give it from its own accent — opens the chat in a panel on the right and moves the page aside
to make room; a round button in the same corner and the same look closes it again; while the pointer rests on the corner, a round button "Open in new tab"
slides in beside it and opens the chat in its own tab, signed in through the app's way in when it has one; it shows while the pointer rests
on the corner or the keyboard reaches it, not after a click; the edge between them lights up under the pointer and
can be dragged to change the width. Page and chat scroll with slim scrollbars while the panel is open, so two broad
bars never stand side by side. When the page reloads or the user follows a link, the panel comes straight back as it
was — open or closed, width, the open conversation and any text not yet sent — while the agents carry on undisturbed on
the server. Inside the panel the conversation list always stands beside the chat as its narrow icon strip, which cannot be
folded away or widened; the menu button opens the full list over the panel, as on a phone. The chat only loads once the panel is first opened, and a conversation in the panel shows its last ten
messages first, loading earlier ones on scrolling up. The app shows the panel only to its signed-in users and tells
it its own way into the chat — required for an app with a login, optional for one without, such as a local setup; a panel that finds its person not yet signed in to the chat goes that way once by
itself, so they are signed in inside the panel without a separate step.

Chat tabs in the background let go of their live connection and catch up as soon as they are in front again, so many
open chat tabs never hold up a page that loads the chat.

Only a signed link lets someone in. The chat signs these links itself; the Laravel app is only the
door: for its signed-in user it asks the chat for a link, proving itself with the chat's key — one the
chat is given, or else one it creates on its first start and keeps in its data folder, where the app reads it —
and passes on who the person is in the app, their name and picture (see [People in the chat](chat-people.md)). The link carries them and its signature as
query parameters, works once and only for about a minute. Opening it signs the person in to that
browser for good — until the key on the server is changed. Anyone reaching the chat without a valid
link or an earlier sign-in sees only "Unauthorized". There is no other way in: no password, no
emergency link.

Besides the chat itself there is a hub: the same chat as an installable app on its own address (GitHub
Pages), which connects to the chats of several containers at once — on the phone, and on the desktop
for developers looking after several projects in parallel. A chat served from the container never
connects to other containers. A device is paired with a container once, from Remote control in that
chat's settings: by pasting its pairing link or scanning its QR code. Pairing hands the container the
device's own public key; from then on the device proves itself with the private key, which never
leaves it. A pairing link works once and only for a few minutes. The chat accepts requests from other
addresses only from the hub.

Everyone in the chat has a name, and the agents always know who is writing; how people are named
and shown is described in [People in the chat](chat-people.md).

### Conversations

The conversations are listed in a sidebar, described in [Conversations in the sidebar](chat-sidebar.md).
Going back to one of the last five conversations opened shows it at once, exactly where it was left, without loading
it again; it kept receiving new messages meanwhile. Any other conversation first shows the copy the browser keeps of it
and then brings it up to date. Every conversation also opens where it was last left in that browser tab — after
switching or reloading the page — and at its end when it was left at the end.
Each conversation is its own agent session. The agent's answer appears while it is
being written; its tool use and reasoning are visible as separate, quieter blocks next to the
answer rather than mixed into it, their content slightly indented under their title. An opened step shows its command, file changes and output with
code highlighting in the language they are written in — a command's output in the language of the
last file the command names whose language is known; where no language can be told, a basic
highlighting still sets strings, numbers, dates, links and words like "error" apart. Errors stay
plain red. What the agent changed in files is described in
[File changes in the chat](chat-file-changes.md).
Code blocks in answers are highlighted in the language they name, any language highlighting knows; a block
that names none, or one highlighting does not know, still gets the basic highlighting rather than none.

In the message input, Ctrl+J starts a new line, as Shift+Enter does.

Any message can be copied with one click. To comment on specific passages, the user selects text
in the conversation and quotes it: the passage lands in the message input as a quote with the
cursor below it, ready for a comment. Quoting again appends the next passage below what is already
written, so several quoted remarks can be collected in one message. Quotes look like quotes while
writing, and the user's sent messages are formatted like the agent's answers; in both, every line
break shows as written, the way Claude Code's terminal shows it. A very long sent
message is shown collapsed to its beginning and can be expanded and collapsed again; it starts
collapsed whenever the conversation is opened. Copying always takes the whole message.

Opening a conversation shows its history only once it is fully laid out, appearing at once at the latest message,
rather than visibly growing while messages, formatting and pictures are set. Placeholders only show when nothing is
there to show after a short moment — never when the browser still has the conversation from last time.

The browser keeps the last state it saw — who is signed in, the conversation list, people, agents and the latest
messages of each conversation opened — and shows it at once on the next start, while the current state is fetched
and replaces it a moment later. A sign-in that is no longer valid still ends in the signed-out screen.

Text typed into a conversation's message input but not yet sent is kept per conversation in that browser: it is
still there after switching to another conversation, reloading the page or closing the tab, and goes away once the
message is sent or the input is emptied. The input for a new conversation keeps its own draft the same way.

Messages can be dictated and read aloud, as described in [Voice in the chat](chat-voice.md).

When a stop hook of the project sends the agent back after its answer — a final code check, say — the answer
still ends where the agent finished it. What the agent replies to the hook stays hidden; a shield-with-check button
named "Stop hook" among the message's actions unfolds it as a small grey line behind the same icon, without section
bars, and folds it again. A reply that is nothing but a bar shows no line. The line is left out when the message is copied, in notifications and in
what other agents read. When Claude summarizes a long conversation to make room, a small grey line "Conversation
summarized" marks the spot in the answer where it happened, since the agent remembers less detail from before it. While the
summary is being written, the same line reads "Summarizing conversation…" behind a glowing, pulsing dot in the accent colour, with a white
light streak running across the words, and turns into
the finished line in place; a summary that fails leaves no line.

Every conversation keeps its full history — messages, tool activity, and the files and images
exchanged — and comes back complete after a page reload or a container restart. A newer version
of the chat takes over the stored data on its own, keeping a copy of it first; an older version
refuses to start on data a newer one has already converted, instead of damaging it.

The history is kept permanently and never cleaned up automatically, so the whole development
process behind an app can be evaluated once the app is finished. For each tool call the history
keeps the call itself in full — including every change made to a file — whether it succeeded, and
the beginning of its output, enough to see why a call failed. Each answer also records the model,
token usage, cost, duration and whether it finished, was stopped or failed.

### Stopping and pausing

There are no chat commands. Two controls replace the ones that mattered:

- **Stop** interrupts the answer currently being produced. The conversation stays open and can
  continue with the next message. Pressing Esc twice within two seconds stops as well: the first press shows
  "Press Esc again to stop" above the message input; while a dialog, menu or suggestion list is open, Esc only
  closes that.
- **Pause** ends the running agent session but keeps the conversation resumable. Sending a new
  message picks the conversation up again. While the paused session starts up again, the dots
  waiting for the answer say "Starting…".

While the agent is answering, the user can keep writing. With an empty message input the send
button stops the answer; once something is typed, it sends. A message sent during an answer does
not interrupt it: it waits in a queue shown above the message input, and the agent takes it up at
its next step, the way Claude Code does. At that moment the message moves into the conversation and
the agent's answer continues below it. A message still queued when an answer ends or is stopped is
answered next. If the session is paused before the agent took up a queued message, the message
moves into the conversation and is answered when the conversation continues.

A session also pauses on its own after 30 minutes without any activity. Work never counts as
inactivity: while the agent is answering or a task it started in the background is still running,
the session stays online however long that takes. An open conversation shows the same state next
to its title.

While tasks the agent started in the background are running, a box pinned above the message input
always lists them, each with its description and how long it has been running. When such a task
finishes and the agent reports back on its own, that report appears and is stored like any other
answer.

### Questions, plans and permissions

The agent works without asking for permission: it runs commands and changes files on its own, so a
task is never held up by approval prompts. When it has a question or proposes a plan, it says so in
its reply, and the user answers with the next message.

How marked sections of an answer and its questions are shown, and how options are chosen, is described in
[Sections and question cards](chat-answer-sections.md).

### Files and images

Files and images the agent sends — screenshots, reports, exports — appear inline in the
conversation and are stored with it. When an agent finishes something substantial that
can be seen, such as a new page, screen or feature, it shows the result without being asked: screenshots
of the key views, sent together so they form a gallery, each with a short caption naming what it
shows. A caption appears under the picture — in a gallery under the one being shown — and in the image
viewer in place of the file name. Small tweaks such as
a colour or a label get no screenshot. People can attach files of any type to their own messages as
well — by picking them, dropping them onto the chat or pasting them — up to 2 GB each; a message may
consist of attachments only. Attached files are stored with the conversation and shown in the sent
message the same way as the agent's. Any shared file whose content is text opens in a preview beside the
conversation, whatever its name or extension. The agent never receives their content inline: it gets the
list of saved paths ahead of the message text and reads the files itself.

### People, agents and settings

Several people and several agents can share a conversation. How people appear is described in
[People in the chat](chat-people.md), how agents are added and take turns in
[Agents in the chat](chat-agents.md), and the Settings window in [Chat settings](chat-settings.md).

### Push notifications

When an agent has finished an answer, the chat can notify the person on their devices through Orbit, the chat hub
([Orbit](chat-hub.md)), but only on devices where that person switched notifications on for this chat. The notification goes to everyone who has written in
the conversation, except people who muted the conversation in Orbit; muting is per person and stops
only the notifications. It is sent once the whole answer is finished, so a hand-over from one
agent to the next does not notify in between, and never when the answer was stopped. It shows the conversation title and
the agent's name with the start of the answer. When the answer failed, a short sentence says it could not be completed instead, in the
person's language — the one they chose in the chat, else their device's. A device that shows this chat on screen for that person is skipped. Each device
brings its own key for sending to it and hands it to every chat it switches notifications on for, so several
chats notify the same device without any service in between.

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
