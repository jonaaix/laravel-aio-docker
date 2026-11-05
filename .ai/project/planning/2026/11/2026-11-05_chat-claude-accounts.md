# Several Claude accounts in the chat

## Goal

The chat keeps several Claude accounts signed in at once and switches between them by hand, so a team whose main
account has used up its quota keeps working without signing in again. Finished when, in the container, a second
account can be added next to the first, a switch moves every following message onto the chosen account while a
running answer finishes on the old one, and switching back needs no new sign-in.

## Milestones

- [x] claude-threads: `ClaudeCliAccount.configDir` sets `CLAUDE_CONFIG_DIR` for the child (HOME stays, so the
      agent's git, ssh and tool config keep working)
- [x] Account store: list of accounts (id, e-mail, organisation, plan, added by, last known usage) and the active one
      in settings; per-account config folder under the data dir that links every entry of the main Claude folder
      except its own credentials and `.claude.json`
- [x] The existing sign-in becomes the first account; "Add account" signs in into a fresh folder
- [x] Sessions start on the active account; a switch pauses idle sessions at once and running ones when their answer
      ends; usage is recorded per account
- [x] API: list, add (start/code), switch, remove
- [x] Settings → Claude account: list with e-mail, plan, last usage, active mark, Switch, Remove, Add account
- [x] Sidebar account card: menu with all accounts and their usage to switch in two clicks
- [x] Test in a container with an empty Claude folder and fake credentials (mechanics)
- [ ] Real accounts in the container (user)
- [x] Feature Book: settings chapter

## State

- Built: `claude-accounts.ts` (store, folders, active account), `account-status.ts` (per-account profile and usage,
  sign-in, switch, sign-out), `claude-login.ts` (sign-in into the account's folder), routes `account/switch`,
  `account/logout` with id, settings list and sidebar menu.
- Verified in a fresh `node:22-slim` container with Claude Code 2.1.318 and fake credentials: `CLAUDE_CONFIG_DIR`
  reports each folder's own account and leaves the main login untouched. On the dev Mac the existing login was
  taken over as the first account with its usage.
- Not yet done with real accounts: adding a second account, switching mid-answer, resuming a conversation on the
  other account. The user tests this in the container.

## Decisions

- Manual switching only, never automatic (user's call).
- Anyone who can open the chat may add and switch accounts (user's call); hidden account details keep working per
  account.
- Quick switch from the sidebar account card (user's call, question 163a).
- A switch applies at once; running answers finish on the old account (user's call, question 164a). Each session
  keeps its own config folder, so an old session refreshing its login can never overwrite the chosen account.
- `CLAUDE_CONFIG_DIR` instead of claude-threads' `HOME` override: changing HOME would cut the agent off from the
  container's git, ssh and tool settings.
- Conversation transcripts stay shared: every account folder links the main `projects` folder, so a conversation
  resumes on whichever account is active.
- Tested in the container, not on the developer Mac: macOS keeps the Claude login in the Keychain, and touching it
  would sign out the developer's own Claude Code.

## Open

- Nothing.
