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
instead of handing over a file to download. Agents reach for the blocks on their own whenever people should compare, choose,
look or take stock rather than read, and a prompt or project rule can ask for them too; answers without them keep their usual formatting, including the clickable question cards (see
[Answer sections](chat-answer-sections.md)).

## How does it work?

The texts of every block — titles, options, descriptions, card texts — are written in the chat language of the
person who started the conversation, whatever language the agent's project otherwise works in; the pages themselves
are free.

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

Where a plain question in the text would not do — for example when each option needs a description — the agent asks
in a card: the question, then two to six lettered options with name and optional description; when the agent recommends one, it is a),
marked "Recommended". Having asked, the agent ends its answer and waits for the reply.

### Cards

For a comparison, a summary or the state of several parts the agent shows a grid of up to twelve cards, with an
optional title above it. Each card has a title and optionally a short text, which may hold a list. The grid adapts to
the width, cards in a row share their height. A card can carry a status: good tints the whole card green, warning
amber, bad red, each with a matching symbol beside the title; cards without a status stay neutral.

### Picking

In variants and choices, clicking an option — for variants anywhere on its card — puts it into the message field as its letter and name, such as
"b) Compact list", on the first line; anything the person has already written stays below it, and clicking another
option of the same block replaces the line. Nothing is sent until the person sends the message, so they can add to it.
Options can only be picked on the latest answer while the agent is not working; once the person has answered, the
option they sent stays marked.

### When an agent describes a block wrongly

A block that is incomplete or wrong — a missing name, too few options, a recommendation that names no option, a page
that is not an HTML file — is refused straight away with a message naming the problem, and the agent corrects it.
Nothing half-built reaches the chat.

## Examples

- Asked to rework a settings screen, the agent shows five lettered layouts as cards, two side by side, c) marked as
  recommended. The person clicks c), adds "but with the toolbar of b)" and sends it.
- The agent builds a report page and shows it embedded; after feedback it shows the corrected version as a second
  page below its next answer, while the first one still shows the old state.
- Checking a deployment, the agent shows four cards — database, queue, mail and storage — the mail card red with
  "No SMTP host set", the others green.
- The agent asks in a choice card which of three export formats to use, each with a one-line description; the person
  clicks b), which appears as "b) CSV" in the message field.
