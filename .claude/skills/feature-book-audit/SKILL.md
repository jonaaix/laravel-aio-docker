---
name: feature-book-audit
description: On explicit user request, comprehensively audit the implementation against the Feature Book for a feature, a domain, or the whole book, with persistent coverage and resumable findings. Do not invoke for routine edits or reminders.
---

# Feature Book Audit

Compare implementation with the current agreed chapters of the Feature Book in `.ai/project/features/`.
Start only on an explicit audit request. The request authorizes reports and checkpoints — not
implementation repairs, requirement changes, or new permanent tests. The chapter says what
should happen; the code never does.

## Scope

- Resolve the requested feature, domain, or the whole Feature Book. If the target is unclear
  and cannot be inferred, ask before an expensive scan.
- Follow linked chapters and cross-feature interactions relevant to the target. Inspecting
  a neighbouring feature for support is not auditing it.
- Navigate by the index, but enumerate the chapters in scope — unindexed files exist.
- Missing chapters and unresolved requirements are coverage gaps, not permission to infer
  requirements from code. Report them and continue with what can be assessed.
- Honor explicit limits when measurable; state what you cannot measure. Never infer remaining
  quota. Stop when the scope is covered or the limit is reached.

## Run state

- Create `.ai/project/audits/<year>/<month>/<YYYY-MM-DD>_<scope>_<unique-run-id>/report.md`.
  Never overwrite a different run. Show the target tree before writing.
- The report is the checkpoint. Save after each feature or substantial batch.
- Record scope, start time, completion state, limits, chapter paths, feature IDs, code
  revision and worktree state. **A commit alone is not a baseline** when local changes exist:
  record changed and untracked paths with content hashes, chapter files included.
- Never copy secrets or whole source files into a report.
- Track multi-step work as required by the planning guideline, linking to the report rather than
  duplicating coverage.

## Extracting checks

- Read all three sections — What is it for?, How does it work?, Examples — including
  feature-specific subheadings.
- Extract the checkable statements before deep review, throughout the chapter.
- Assign check IDs **in the report only**. Never insert rule IDs into chapters. Each
  ID links to the chapter, the section and a short source excerpt; keep those when resuming.

## Judging the implementation

- Check intended outcomes and explicit technical requirements. Never substitute your preferred
  architecture. Choices the chapter leaves open are implementation freedom, not defects, and
  incidental detail in an example is not a restriction. Flag ambiguity instead of inventing a
  stricter contract.
- Trace the applicable execution paths: entry points, authorization, validation, services,
  persistence, jobs, external boundaries. Inspect success, rejection, boundaries, state
  transitions and cross-feature effects. **A matching method name or a green test suite does not
  prove the described behavior.**
- Use existing tests and focused, non-persistent probes. Before executing anything, establish
  that writes and external effects are isolated from real data and services. Never reset the
  development database. Without safe execution, continue statically and mark the missing runtime
  evidence. Never install dependencies or change the application to make an audit pass.

### Outcomes

Record exactly one per extracted check:

- **Conforms** — inspected paths support the statement. Identify static and runtime evidence
  separately.
- **Deviation** — evidence shows behavior inconsistent with the agreed behavior.
- **Not verifiable** — ambiguity, inaccessible paths or insufficient evidence.
- **Pending** — not examined yet. These rows stay when a run is interrupted or limited.

Undocumented behavior is an observation requiring a product decision, not automatically a
defect. Conflicting requirements are specification questions.

## Report

- **Scope and baseline** — requested coverage, inputs with revisions and hashes, environment,
  limits, run state.
- **Coverage** — feature ID, check ID, source passage, outcome, evidence links, finding
  reference. Account for every extracted check.
- **Findings** — stable finding ID, severity by user impact, expected versus observed, code
  locations, reproduction or reasoning, evidence limitations. Group duplicate root causes while
  keeping the affected check links.
- **Checks** — commands and probes with results, plus what was unavailable or deliberately not
  run. Distinguish tests executed from test code merely read.
- **Remaining work** — pending checks, open questions, a concrete continuation point, or None.

## Resuming

Compare the recorded baseline with current code and chapters. Recheck anything affected by
changes, including shared dependencies, and mark that coverage stale until rechecked — never
carry an old outcome forward as current evidence. Preserve the original baseline and identify
subsequent ones.

## Closing

Summarize counts, highest-impact findings, coverage limits and the report path.

- A completed audit means every extracted check in scope was assessed — not that all conformed.
- Never present a partial audit as complete, or an absence of findings as proof that unexamined
  behavior is correct.
- Offer repairs as a separate next task.
