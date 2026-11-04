---
id: ai-chat-people
created: 2026-11-02
tags: [chat, profile, avatars, mentions]
---

# People in the chat

## What is it for?

Several people from one team work in the same chat. Every message has to say who wrote it, both
for the people reading along and for the agents, which answer differently depending on who asks.
Names and pictures make a shared conversation readable at a glance.

## How does it work?

### Names

A person's name and picture come from the signed link they signed in with (see [AI web chat](web-chat.md)):
the name is taken over as it is and cannot be changed in the chat, and the chat never asks for one. Along with
the name the Laravel app passes on who the person is in the app; that person is always the same person in the
chat, from any browser. A name already belonging to another person of the app is refused, so nobody can sign in
under someone else's name. Someone known from before this rule takes their name over on their next sign-in.

The Laravel app usually sends first and last name. Conversations show only the first name: beside messages,
among the participants, in the sidebar, in the `@` suggestions and in what the agents are told. When two
people share a first name, both carry the initial of their last name ("Jonas G.", "Jonas M."); if that still
matches, the full name. A name without a last name stays as it is. Profile and People keep the full name. A new picture shows on all their earlier messages too, for
everyone, right away. Each new conversation keeps the name of the person
who started it, and every message keeps the name of the person who sent it. The agent learns who is
writing: the first message of a conversation, and every message from someone other than the previous
sender, tells it the sender's name. The conversation itself shows the message exactly as it was
written.

### Pictures and chat heads

Everyone taking part in a conversation — people and agents — appears with a chat head: a picture
derived from their name with the name beneath it, next to each of their messages. People and agents
are drawn in clearly different styles. The title bar shows the participants' pictures at the top
right, all the same size and each in a circle, with the name on hover.

A person without a picture of their own gets a drawn one derived from their name; in their profile
they can pick another from a random selection in three drawn styles (abstract glyphs, hand-drawn
Notionists heads and Dylan faces), upload a picture of their own or remove it again.
When the Laravel app opens the chat, it can pass the address of the person's picture along with the
name; the chat fetches it, fetches it again whenever the address changes, and the person cannot
replace it in the chat. Agent pictures are described in [Agents in the chat](chat-agents.md).

### Mentions

An agent in the conversation can be addressed with `@Name`, and so can every person who has written
in it; typing `@` suggests them, and mentions stand out in the conversation.

## Examples

- The Laravel app opens the chat for Jonas Gnioui with his name and profile photo in the address. The chat
  shows his photo and "Jonas" next to his messages; once Jonas Müller joins, they read "Jonas G." and
  "Jonas M."; the profile shows name and photo but does not let him change
  them.
- Someone opens the chat directly for the first time and is asked for a name before anything else.
  They type "Mira" and pick one of the drawn pictures; from then on Mira's messages carry that
  picture, and the agent is told that Mira is writing.
