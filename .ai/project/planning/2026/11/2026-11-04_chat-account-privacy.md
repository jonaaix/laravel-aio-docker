# Account privacy in shared workspaces

## Goal

A workspace whose Claude account is lent to friends must not show that account to everyone. Admins decide
whether the others see the account details; the others then see only the session usage. Nobody can sign in under
someone else's name. Finished when the switch works for admins, the others' browsers never receive the
hidden details, and a taken name is refused.

## Milestones

- [x] People known by their app user (`userRef` in the signed link, `users.app_user_ref`); a name belonging to
      another app user is refused (409 at link and at sign-in); guide for the Laravel agent updated
- [x] Admin role (`users.is_admin`), unlocked by seven taps on one's own picture in Profile; People settings
      (admins only): make or remove admins, block or unblock (`users.blocked_at`)
- [x] Block enforced: every request and both live streams of a blocked person end at once, sign-in links for
      their `userRef` are refused (403), redeeming one is refused
- [x] Switch "Show account details to everyone" (default: shown); hidden → non-admins get no email,
      organisation, plan or weekly usage from the server, only the session usage
- [x] Per person: show or hide the account details apart from the default (`users.account_details`, only stored
      where it differs from the default at the time it is set)
- [x] Feature Book: chat settings chapter

## State

- Built and checked in Chrome with two test people: unlock after exactly seven taps, hidden details reach the
  other person only as "Claude account" with session usage, blocking signs them out at once and refuses new
  links; test people removed afterwards.

## Decisions

- Hidden details: email, organisation, plan and every usage meter except the session (user's call).
- Default: details shown until hidden (user's call).
- Admins decide. Admin is unlocked by a hidden trick without any key: the chat is not public and nobody taps
  a picture seven times by chance (user's call). A key or first-person rule was rejected.
- Admins can make others admins, remove admins and block people; nothing else is admin-only (user's call).
- Everyone may still switch or sign out the Claude account, e.g. to use their own (user's call).
- A blocked person is not told so; they see the same "Unauthorized" as anyone not signed in. A dedicated
  "access blocked" page was rejected (user's call).
- `userRef` is required in every link: without it a taken name could not be told apart from its owner.

## Open

- Nothing.
