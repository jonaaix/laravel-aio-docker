# Claude account sign-in

## Goal

People sign the container's Claude Code in and out of a Claude subscription from the chat's
settings, without a terminal. Finished when "Claude account" in the settings shows the signed-in
account, signs out, and signs in through Claude's own page plus a pasted code, and the sidebar card
follows in every open browser.

## Milestones

- [x] Server: drive `claude auth login` (code paste flow) and `claude auth logout`; refresh the cached
      account profile and announce it on the list events
- [x] Settings category "Claude account": signed-in view with sign-out, sign-in with link, code field,
      cancel, errors at the field
- [x] Sidebar card: "Not signed in" opens the category
- [x] Verified against a stand-in CLI (success, wrong code, cancel, sign-out); the real flow is tried by
      the user in the container

## State

- `claude-login.ts` runs `cat | script … claude auth login & wait $!` in its own process group: `script`
  supplies the terminal, `cat` a plain pipe (macOS `script` rejects Node's socket stdin), the group kill
  removes all of it. The authorize URL is read from the output (OSC 8 link); after the code is written,
  success is confirmed by polling `claude auth status` (macOS `script` does not exit while stdin is open),
  failure by an error line or a non-zero exit.
- Verified against a stand-in CLI and the start step under Linux in the beta image; the real sign-in is
  still to be tried by the user in the container.

## Decisions

- The normal subscription login for the whole container, not a chat-only token (user's call).
- Anyone who can open the chat may sign in and out until access protection exists.
- No real sign-in during development: on macOS a login would replace the user's own keychain login;
  the real flow is tested by the user in the container.

## Open

- None.
