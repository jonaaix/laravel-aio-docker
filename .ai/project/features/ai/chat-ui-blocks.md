---
id: ai-chat-ui-blocks
created: 2026-11-05
tags: [chat, agents, mcp, design-alternatives, choices]
---

# Building blocks agents place in the chat

## What is it for?

An agent can do more than write text and send files: it can shape the chat's interface at the point of its answer
where it needs it. It describes a building block as data, and the chat draws it in its own style. This lets an agent
show a prototype or a set of design alternatives right in the conversation and let people choose with a click,
instead of handing over a file to download. Whether an agent uses the blocks depends on what it was asked or told to
do; answers without them keep their usual formatting, including the clickable question cards (see
[Answer sections](chat-answer-sections.md)).

## How does it work?

### Page

An agent shows an HTML page it has written. The page appears embedded in the answer at full width and at a fixed
height, with an optional title above it, and scrolls inside that height. It is frozen as it was when sent: if the agent
revises the file, it shows the revision as a new page, so the earlier versions stay in the conversation. The page runs
shut off from the chat — it can run its own scripts but never reaches the person's sign-in or the rest of the chat,
not even when opened on its own. Only the page itself is kept, so it has to bring everything it needs along.

### Variants

For design or UX alternatives the agent shows one page holding all variants, lettered a), b), c)… on the page itself,
and beneath it the matching list: each variant's letter, name and an optional short description, with the
recommended one marked "Recommended". Two to six variants are possible.

### Choice

Where a plain question in the text would not do — for example when each option needs a description — the agent asks
in a card: the question, then two to six lettered options with name and optional description, one of them possibly
marked "Recommended". Having asked, the agent ends its answer and waits for the reply.

### Cards

For a comparison, a summary or the state of several parts the agent shows a grid of up to twelve cards, with an
optional title above it. Each card has a title and optionally a short text, which may hold a list. The grid adapts to
the width, cards in a row share their height. A card can carry a status: good tints the whole card green, warning
amber, bad red, each with a matching symbol beside the title; cards without a status stay neutral.

### Picking

In variants and choices, clicking an option puts it into the message field as its letter and name, such as
"b) Compact list", on the first line; anything the person has already written stays below it, and clicking another
option of the same block replaces the line. Nothing is sent until the person sends the message, so they can add to it.
Options can only be picked on the latest answer while the agent is not working; once the person has answered, the
option they sent stays marked.

### When an agent describes a block wrongly

A block that is incomplete or wrong — a missing name, too few options, a recommendation that names no option, a page
that is not an HTML file — is refused straight away with a message naming the problem, and the agent corrects it.
Nothing half-built reaches the chat.

## Examples

- Asked to rework a settings screen, the agent shows a page with five lettered layouts and the list a) to e) beneath
  it, c) marked as recommended. The person clicks c), adds "but with the toolbar of b)" and sends it.
- The agent builds a report page and shows it embedded; after feedback it shows the corrected version as a second
  page below its next answer, while the first one still shows the old state.
- Checking a deployment, the agent shows four cards — database, queue, mail and storage — the mail card red with
  "No SMTP host set", the others green.
- The agent asks in a choice card which of three export formats to use, each with a one-line description; the person
  clicks b), which appears as "b) CSV" in the message field.
