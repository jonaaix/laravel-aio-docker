---
id: ai-chat-ui-blocks
created: 2026-11-05
tags: [chat, agents, mcp, design-alternatives, choices, timeline]
---

# Building blocks agents place in the chat

## What is it for?

An agent can do more than write text and send files: it can shape the chat's interface at the point of its answer
where it needs it. It describes a building block as data, and the chat draws it in its own style. This lets an agent
show a prototype or a set of design alternatives right in the conversation and let people choose with a click,
instead of handing over a file to download. Agents reach for the blocks on their own whenever people should compare, choose,
look or take stock rather than read, and a prompt or project rule can ask for them too; answers without them keep their usual formatting, including the clickable question cards (see
[Answer sections](chat-answer-sections.md)).

## How does it work?

The agent learns the chat language of the person who started the conversation, so it can write the texts of its
blocks in it; the pages themselves are free.

### Page

An agent shows an HTML page it has written. The page appears embedded in the answer at full width and at a fixed
height, with an optional title above it, and scrolls inside that height. It is frozen as it was when sent: if the agent
revises the file, it shows the revision as a new page, so the earlier versions stay in the conversation. The page runs
shut off from the chat — it can run its own scripts but never reaches the person's sign-in or the rest of the chat,
not even when opened on its own. Only the page itself is kept, so it has to bring everything it needs along.
Its scrollbar is drawn thin and quiet.

Above the page sit its title and three actions. "View larger" opens it in a large window over the chat; a handle at
the page's edge drags its width narrower or wider, with the current size shown below, so the page can be checked at
phone and tablet widths — a double click on the handle gives it the full width again. Beside the size readout, a strip switches it in one click: Window (filling
the window, as it opens), Phone (402 × 874), 13″ (1470 × 956), 24″ (1920 × 1080) and 27″ (2560 × 1440),
each with a symbol; a size larger than the window is shown scaled down to fit, with the scale beside the size. On a phone the large
window takes the whole screen, without the strip or the width handle. The large window's title bar offers "View code" and "Open in new tab" as
well, so neither needs the window closed first; the code opens on top of the large window. "View code" opens the HTML in
the preview column beside the conversation, where it can be copied or downloaded. The "More actions" menu opens the
page on its own in a new tab, still shut off the same way, or downloads it; a downloaded page carries the date and
time the agent showed it in its name, such as "landing-2026-11-05_143207.html": downloading the same page again gives
the same name, while the versions of a draft line up in order in the download folder.

### Variants

For visual design or UX alternatives — never for plain questions — the agent shows two to six variants as selectable
cards, each variant its own HTML page holding only that variant. Each card carries at its top left the variant's letter on a
small key cap that works as its radio button — filled in the accent colour once chosen — followed by the variant's
name, option a) — always the recommendation when there is one — marked by a filled "Recommended" badge right after the
name, an
optional short description beneath the name, and a live preview of the variant at the card's full width and the
height the agent gives it, laid out for that width as a real page would be. Under Settings → Chat the previews can
instead be scaled down from the screen width the agent designed the variants for. The preview can be used like the page itself — clicked, scrolled, text selected; selecting the
variant takes a click on the card outside the preview. The agent chooses a small canvas
(about 350 px, two cards side by side) or a large one (about 740 px, one card per row); on a phone they always stand one
per row. A button on each card opens that variant in the large window with its screen sizes, code and download; there
the arrow keys ← and → and two arrow buttons in the title bar step to the previous or next variant.

### Choice

For questions the agent asks in a card: the question, then two to six lettered options with name and optional description; when the agent recommends one, it is a),
marked "Recommended". The agent can let a question — and a set of variants — take several answers; then each click switches one option on or
off, and the chosen ones stand together on one line, such as "a) Basic, c) Business". Having asked, the agent ends its answer and waits for the reply.

### Cards

For a comparison, a summary or the state of several parts the agent shows cards grouped into sections, all in one
block: each section has its own heading and up to twelve cards, the sections sorted by importance, the most important
first. Each card has a title and optionally a short text, which may hold a list. Within a section all cards look the
same; a section can carry a message — good tints all its cards green, warning amber, bad red, with a matching symbol
beside its heading — and a section without one stays neutral. Cards stand two per row, the agent can make a card wide
so it takes the whole row, and on a phone they stand one per row. Cards in a row share their height.

### Charts

For numbers the agent shows a chart — a line, bars (also stacked), a pie or a doughnut — from labels and one or more
named series, with an optional title and unit. The chat draws it at a fixed height in its own look: colours derived
from the accent colour, the legend on top, the values with their unit on hover, following light and dark mode and a
change of the accent colour. Reading aloud names only its title.

### Timeline

For a sequence — the steps of a plan or task, the course of events, or a grouped list — the agent shows a timeline: a
vertical line with one dot per entry. Entries can be grouped, each group under its own heading, and all groups come in
one block. An entry has a title, optionally a short mark beside the line (a time, a date, "Step 2") and a short text.
It can carry a state: done shows a filled dot in the accent colour, running a pulsing one, open a hollow one; without a
state the dot stays neutral. Marks line up in one column across all groups. Reading aloud reads headings and entries in order.

Entries can run in parallel lanes, such as teams working at the same time; the lanes of a group stand side by side,
each under its name. Entries can also carry a start and an optional end, as a time of day or as a date with a time.
A group with times is drawn to scale like a day in a calendar: time runs downwards along a time column, each lane is a
column, an entry with an end is a block whose height shows its duration, and one without an end is a point in time.
Entries of one lane that overlap stand next to each other, and blocks that follow one another keep a small gap. A block too short for its text unfolds downwards over its neighbours while the pointer rests on it, or when tapped on a phone, and shows the whole text; near the end of the plan it moves up as far as needed to stay inside. A time of day that ends before it starts runs past midnight.
Within a group either every entry has a time and a lane or none does. Where the lanes do not fit the width, as on a
phone, they can be swiped sideways while the time column stays in place.

### Picking

In variants and choices, clicking an option — for variants anywhere on its card — puts it into the message field as its letter and name, such as
"b) Compact list", on the first line; anything the person has already written stays below it, clicking another
option of the same block replaces the line, and clicking the chosen option again takes it out. Nothing is sent until the person sends the message, so they can add to it.
Options can only be picked on the latest answer while the agent is not working; once the person has answered, the
option they sent stays marked. A choice card then folds to the options that were sent — or says "Not answered" when
none was — with "Show all options" to unfold it, as the question cards do.

### When an agent describes a block wrongly

A block that is incomplete or wrong — a missing name, too few options, a recommendation that names no option, a page
that is not an HTML file — is refused straight away with a message naming the problem, and the agent corrects it.
Nothing half-built reaches the chat.

## Examples

- Asked to rework a settings screen, the agent shows five lettered layouts as cards, two side by side, c) marked as
  recommended. The person clicks c), adds "but with the toolbar of b)" and sends it.
- The agent builds a report page and shows it embedded; after feedback it shows the corrected version as a second
  page below its next answer, while the first one still shows the old state.
- Checking a deployment, the agent shows a red section "Problem" with the mail card ("No SMTP host set") above a green
  section "Fine" with database, queue and storage.
- Reporting a release, the agent shows a timeline "Today" with two done steps at 09:30 and 09:42 and a running
  meeting at 10:00, and "Tomorrow" with the open review at 14:00.
- For a dinner, the agent shows three lanes — starter, main course, dessert — from 15:00: the tiramisu is layered at
  15:00 and then sets until 22:00 as one long block, while the roast and the sauce overlap in the main-course lane and
  "Guests arrive" is a point at 18:30.
- The agent asks in a choice card which of three export formats to use, each with a one-line description; the person
  clicks b), which appears as "b) CSV" in the message field.
