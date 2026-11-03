---
id: ai-chat-settings
created: 2026-11-02
tags: [chat, settings, appearance, profile]
---

# Chat settings

## What is it for?

People shape the chat to their taste and manage the agents in one place. The window is built to
take further categories as the chat grows.

## How does it work?

Settings at the foot of the sidebar, below Archived, opens one Settings window with its categories on the left (on
phones as tabs along the top): Appearance, Agents, Profile and Claude account, opening at Appearance. "Manage agents" in the agents menu of
a conversation opens the same window at Agents.

- **Profile** holds the person's name and picture, as described in
  [People in the chat](chat-people.md). The very first prompt for a name is not part of this window
  and cannot be dismissed.
- **Appearance** sets the theme — light, dark or the system's — and the font of the whole chat:
  System UI (the default), Geist, Inter, Source Sans 3, IBM Plex Sans or, for those who prefer
  monospaced text throughout, JetBrains Mono, set a size smaller so it reads as large as the
  others, each shown in its own
  typeface. It also holds "Move sent message to top", off by default: when off, the conversation
  stays at the bottom after sending and follows the answer; when on, the sent message moves to the
  top with room below for the answer. Every choice applies at once and belongs to the person, so it
  follows them to every device and browser.
- **Agents** defines the agents, as described in [Agents in the chat](chat-agents.md).
- **Claude account** signs the container's Claude Code in to a Claude subscription and out again, the
  same login a terminal `/login` creates. Signed in, it shows the account's e-mail, organisation and
  plan with "Switch account", which signs in another account directly, and "Sign out". Signed out, "Sign in with Claude" offers Claude's own sign-in page in a new tab
  and a field for the code that page shows; a wrong code or a failed sign-in says so, and a sign-in in
  progress can be cancelled. Anyone who can open the chat may do this. The account card at the foot of
  the sidebar shows "Not signed in" while no account is signed in and opens this category; it follows
  sign-ins and sign-outs in every open browser. While signed out, a notice above every message input
  says "Claude is not signed in" and its "Sign in" opens this category; while a usage limit is reached,
  it says "Usage limit reached" with the time agents can answer again. Usage figures start over with
  every sign-in and sign-out, so they never show another account's usage.

There is no save button: every change is stored as it is made — text a moment after typing stops or
on Enter, choices, pictures and files at once — and errors show at the field concerned. "New agent" adds an entry to the list at once; the agent
is created as soon as it has a name and a role, both required. Only deleting an agent asks first. In Profile and Agents
the name comes before the picture.

## Examples

- Jonas picks Inter under Appearance; the whole chat switches to Inter immediately. The next day he
  opens the chat on another computer and it is in Inter there too.
- In a conversation, Jonas opens the + menu and chooses "Manage agents"; the Settings window opens
  at Agents, where he gives Peter Peer a new role.
