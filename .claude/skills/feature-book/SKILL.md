---
name: feature-book
description: Create or substantially revise a Feature Book chapter — a feature's agreed purpose and workings, including relevant technical requirements. Use for Feature Book work; comprehensive implementation audits use feature-book-audit.
---

# Feature Book Chapters

Write chapters that let the user say: "Yes, that is how it should work."
Use plain English for project artifacts and the user's language for discussion. A Feature Book request
permits chapter changes, not code changes. Keep discussion-only proposals in the planning file.

## Establish the Intended Behavior

Read `.ai/project/features/index.md` if present, then relevant chapters, decisions, and code entry points.
Reuse existing coverage. Code can reveal current behavior but cannot establish what the user wants.
Clarify consequential uncertainty before presenting it as agreed behavior. Keep questions and proposals in
planning and audit observations in reports, outside the Feature Book. If intent is unavailable, ask for
it rather than publishing an unconfirmed chapter. Preserve already agreed passages while clarifying
an uncertain change. Do not ask the user to decide technical details that leave the desired behavior unchanged.

## Write the Chapter

Use `.ai/project/features/<domain>/<feature>.md`, one chapter per coherent feature. Add subdomains only
when helpful; never date paths. Show the target tree before creating or moving files.

Use these three section names in this order after the title. The prompts below explain what to write;
replace them with the actual description:

```markdown
---
id: booking-cancellation
created: 2026-10-07
tags: [booking, cancellation]
---

# Cancelling a booking

## What is it for?
Explain what this feature helps someone achieve and why it exists.

## How does it work?
Describe what happens, what someone can do, and the conditions and special cases that matter.
Use subheadings drawn from the feature itself when helpful.

## Examples
Illustrate the agreed behavior through concrete situations and their outcomes.
```

Write connected, familiar language. Features can be interactive or automatic; do not force them into a
particular actor, screen, or step-by-step workflow. Include permissions, limits, or failure behavior only
where relevant to understanding the agreed outcome. Avoid prescribed technical categories, formal rule
numbering, and compulsory code maps. Examples clarify existing intent; they must not introduce new policy.
Do not invent content to fill a section. If missing information prevents a useful description, clarify it.

Leave technical implementation choices open unless they are explicitly required or necessary for the desired
behavior. Describe the visible or meaningful result rather than prescribing classes, tables, or algorithms.
Link related chapters where their behavior matters instead of repeating them.

## Metadata and Maintenance

Keep the unique feature ID stable through moves and renames. Set `created` to the actual creation date once.
Use relevant lowercase, kebab-case tags that help discover the feature and connect related topics.
Reuse existing tags where appropriate; avoid redundant or overly generic terms. Use a comma-separated YAML list
such as `tags: [booking, cancellation]`, not a string. Avoid framework names and temporary review statuses.
Tags aid discovery; direct links explain specific relationships.

Update only passages affected by authorized decisions. Never rewrite desired behavior just to match a defect.
Maintain the index as a compact table of feature ID, relative link, and one-line description; update links
when moving chapters. Do not add audit status or duplicate the chapter in the index.

Check the three sections, metadata, links, and consistency with agreed intent. Read the result as a user:
is the feature understandable, and are relevant technical requirements preserved accurately? Report unresolved decisions
separately. A chapter alone does not prove that the implementation conforms to it.
