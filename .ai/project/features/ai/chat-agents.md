---
id: ai-chat-agents
created: 2026-11-02
tags: [ai-agent, chat, multi-agent, handover]
---

# Agents in the chat

## What is it for?

One coding agent is not always enough: an advisor, a critic or a specialist for sales or design can
add a view the lead agent does not have. Several agents can therefore take part in one conversation,
talk to the people and to each other, while only the lead changes the project.

## How does it work?

### The lead and further agents

Every conversation starts with the lead coding agent, "Tarek LSA" unless renamed. The lead works in
the project with the project's own instructions, sees the whole conversation and gives it its
title. Further agents are defined once in the settings — each with a name, a role, a model, a
description that becomes its own instructions, and files it may use as resources. An agent shows a
robot — derived from its name until one is picked from a random selection — or an uploaded
picture. Uploaded pictures appear in a circle, robots stand free next to messages.

### Switching agents in and out

A + at the end of the pictures in the title bar opens a menu where agents are switched into or out
of the conversation with one click, at any time. The agents in the conversation learn about it with
the next message: it starts with a short note such as "Peter Peer joined the chat." or "Peter Peer
left the chat.".

### Taking turns

Each agent keeps its own session per conversation, with its own model. The first message an agent
receives in a conversation tells it who takes part and what role each agent has. One agent answers
at a time: the first one addressed with `@Name`, otherwise the one that answered last. A message for
an agent other than the one currently answering waits until that answer is finished, and the queue
above the message input names the agent it waits for. An agent hands the turn to another only with
"👉 @Name", ideally as the last line of its answer; it counts wherever it stands, while a plain
`@Name` is just a mention and never passes the turn. It writes its handover so it can be understood
on its own; after 25 handovers without a message from a person, the agents stop and wait for one. An
agent that takes over first catches up on the messages it missed, each labelled with its author.
Every answer shows the chat head of the agent that wrote it, and while an agent answers, a line above
the message input names it ("Tarek LSA is typing…"), as in Mattermost.

### What agents may change

Agents other than the lead work in their own folder, one per agent, shared by all conversations,
since they all work on the same app. They may read and search the project but not change it:
changes to the project are handed to the lead, with the file and what to write. These limits are
fixed; neither people nor agents can lift them from within the chat.

## Examples

- Jonas adds Salem Sales through the + and asks him who would pay for the widget, then to hand
  over to Peter. Salem answers and ends with "👉 @Peter Peer"; Peter answers next on his own.
- Peter mentions "@Tarek LSA" in the middle of a sentence. Nothing happens beyond the mention; the
  next message without `@` goes back to Peter, who answered last.
- Salem is asked to put a note straight into a project file. He declines and hands it to Tarek with
  the file and the text; Tarek checks it and writes it.
