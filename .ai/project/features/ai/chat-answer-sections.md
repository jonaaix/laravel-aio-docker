---
id: ai-chat-answer-sections
created: 2026-11-05
tags: [chat, sections, questions, plans]
---

# Sections and question cards

## What is it for?

Agents structure their answers in the [AI web chat](web-chat.md) with marked sections — a plan, a summary, the next
step, questions. The chat turns those into calm blocks and lets the person answer questions by picking options instead
of typing them.

## How does it work?

Sections the agent marks off with bars — a bar, a title such as "🎯 Plan", another bar — appear
each as a quiet block with a light grey surface and rounded corners, the title on top, without frame or lines; the
bars themselves are not shown. The summary, next-step and question sections look the same. A paragraph that
starts with "⚠️" becomes a block of the same quiet kind, tinted amber, one that starts with "❌" tinted red, and so does a section whose
title starts with one of these marks; other marks at the start of a line stay text. The plan ("🎯"), summary ("🔑"), next-step ("🚀") and questions ("❓") sections are also
recognised when the agent forgets the bars: after a blank line, their mark and a short title open the section,
on a line of their own or followed by a colon and the section's first text ("🚀 Next: …"). Without bars a summary or
next-step section ends with its paragraph; the others run to the next bar or section. The agent that forgot them gets a short reminder
with its next message to put the bars around every section title. In
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

## Examples

- An answer ends with a "❓ Questions" section holding two numbered questions. The chat shows a card; the person picks
  "a" for the first and "b" for the second, adds a remark after one of them and sends.
- The person replies "ok"; the card shrinks to each question with its recommended option.
