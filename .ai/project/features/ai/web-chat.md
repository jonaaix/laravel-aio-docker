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

For working on the app, the chat can also sit beside any of its pages: a button "Open AI chat" at the bottom right, in a
gently moving violet gradient with twinkling sparkles, opens the chat in a panel on the right and moves the page aside
to make room; a small, quiet round button in the same corner closes it again; the edge between them lights up under the pointer and
can be dragged to change the width. Page and chat scroll with slim scrollbars while the panel is open, so two broad
bars never stand side by side. When the page reloads or the user follows a link, the panel comes straight back as it
was — open or closed, width, the open conversation and any text not yet sent — while the agents carry on undisturbed on
the server. The chat only loads once the panel is first opened, and a conversation in the panel shows its last ten
messages first, loading earlier ones on scrolling up.

Chat tabs in the background let go of their live connection and catch up as soon as they are in front again, so many
open chat tabs never hold up a page that loads the chat.

Only a signed link lets someone in. The chat signs these links itself; the Laravel app is only the
door: for its signed-in user it asks the chat for a link, proving itself with a key stored centrally in
the image, and passes on the person's name and picture. The link carries them and its signature as
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

A sidebar lists the conversations, with Settings at its foot. Everyone working in the same container sees all of them, each
with the name of the person who started it: a development conversation is long-lived, and a team
works on the same app. Each entry shows the title and, below it, whether the session is working
(the agent is answering), active (running and waiting) or paused, and when something last
happened. A new conversation is named
after the beginning of its first message. When the user sends the third message, the agent titles
the session from the user's first three messages, the way Claude Code titles its terminal sessions;
that title replaces the name in the chat and also names the session in Claude Code's own history.
Conversations that were already past their third message keep their name. The user can rename a
conversation at any time by editing its title in place. A name the user gave is kept: no title is
generated for that conversation anymore, and the name also reaches Claude Code's session history —
right away while the session runs, otherwise when it resumes. Someone can start a new
conversation, open an earlier one and continue it. A conversation that is no longer needed can be
archived: its agent session is paused first, it leaves the sidebar, and the user lands on the
conversation below it in the sidebar — the one above when it was the last, a new conversation when none is left. It stays stored and can be brought back from the archive, which lists archived conversations and
finds them by title, ignoring case and accents. Each conversation is its own agent session. The agent's answer appears while it is
being written; its tool use and reasoning are visible as separate, quieter blocks next to the
answer rather than mixed into it. An opened step shows its command, file changes and output with
code highlighting in the language they are written in — a command's output in the language of the
last file the command names whose language is known; where no language can be told, a basic
highlighting still sets strings, numbers, dates, links and words like "error" apart. Errors stay
plain red.

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

While a voice service is set up for reading aloud, a microphone sits in the message input: pressing it records,
small bars beside the stop button follow the voice so it is clear the microphone hears something, and pressing stop
has the service write down what was said. The text lands in the input at the cursor, to be checked and sent by hand.
A refused microphone or a failed transcript is said at the input. Without a voice service there is no microphone.

Any message can also be read aloud: the speaker beside "Copy" starts reading and turns into a stop button until it is
done; while it reads, the button stays visible without pointing at the message. With a voice service set up in the settings, a natural voice of that service reads, and a message read once
plays again without asking the service anew; if the service fails, the device's voice reads the rest. Without a
service the device's own voice reads, chosen by the language the message is written in — one of the six chat
languages, recognised by its common words — falling back to the person's chat language for very short texts. Only
the prose is read: no code blocks, tool steps, the stop hook line, markdown marks or emoji. The speed is the person's
reading speed from the settings (Read aloud).

When a stop hook of the project sends the agent back after its answer — a final code check, say — the answer
still ends where the agent finished it. What the agent replies to the hook follows as a small grey line behind a
return-arrow icon, named "Stop hook" on hover; it is left out when the message is copied, in notifications and in
what other agents read. When Claude summarizes a long conversation to make room, a small grey line "Conversation
summarized" marks the spot in the answer where it happened, since the agent remembers less detail from before it.

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
  continue with the next message.
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

Sections the agent marks off with bars — a bar, a title such as "🎯 Plan", another bar — appear
as plain headings with a fine line above them; the bars themselves are not shown. The plan ("🎯"), summary ("🔑"), next-step ("🚀") and questions ("❓") sections are also
recognised when the agent forgets the bars: their mark and a short title on a line of their own, after a blank
line, open the section, which then runs to the next bar or section. The agent that forgot them gets a short reminder
with its next message to put the bars around every section title. A summary section
("🔑") and a next-step section ("🚀") stand out as cards in the same look as the question card. In
the latest answer the next-step card offers to accept the suggestion: it writes "ok" at the start of
the message input, the same way choosing an option does, and nothing is sent until the user sends.

When an answer contains a questions section — a "❓" heading between two bars, numbered questions,
each with lettered options (`a)`, `b)`, …) or a hint for a free answer, and a closing bar — the
chat shows that section as a question card of its own instead of the raw text: every question with
its full text, its options as selectable rows, the recommended one marked. In the latest answer the
options can be chosen: each choice is written at the start of the message input on a line of its
own, such as "44a", so a remark can follow it on the same line. Choosing again changes only that
question's line and keeps the remark; deselecting removes the line; what the user wrote below stays
untouched. The card always shows what those lines say: editing or deleting them changes the chosen
options too. One control
picks every recommended option at once; it leaves the choices in other question cards of the same answer alone, and a question without a recommended option keeps the choice already made. Nothing is sent until the user sends the message, and the
agent learns nothing about the card: it only reads the answer the agent already wrote. Cards in
earlier answers stay visible but can no longer be chosen from. Once the user has replied, the card
shrinks to the questions and the option chosen for each — taken from every answer line in the reply,
wherever it stands, where "ok" means every recommended option; options not chosen fold away and can be shown again. When the
reply answered none of the questions, the card says so once below them.

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
message the same way as the agent's. The agent never receives their content inline: it gets the
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
