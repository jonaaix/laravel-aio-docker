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
phones as tabs along the top): Appearance, Chat, Read aloud, Agents, Profile, Claude account, People (admins only) and Remote control, opening at Appearance. "Manage agents" in the agents menu of
a conversation opens the same window at Agents.

- **Profile** holds the person's name and picture, as described in
  [People in the chat](chat-people.md). The very first prompt for a name is not part of this window
  and cannot be dismissed.
- **Appearance** sets the language of the chat — English, Deutsch, Français, Nederlands, Español or
  Italiano, each named in its own language — which turns every text the chat shows itself, and its
  dates and numbers, into that language; what agents and people write stays as written. Until the
  person picks one, the chat follows the browser's language if it is one of these, else English. The
  mobile app shows the same language. Appearance also sets the theme — light, dark or the system's — and the font of the whole chat:
  System UI (the default), Geist, Inter, Source Sans 3, IBM Plex Sans or, for those who prefer
  monospaced text throughout, JetBrains Mono, set a size smaller so it reads as large as the
  others, each shown in its own
  typeface. It also sets the colour of the whole chat, picked from unnamed colour circles, each shown in
  the button colour it gives (the name appears only as a hint on hover): first Black, the default — plain greys with
  black and white accents, as the chat always looked — then Gray and twenty-two clear, saturated colours in the order
  of the colour wheel, deep tones such as Navy or Burgundy next to their brighter neighbours and darker than them in dark mode too. The circles wrap into
  two rows of equal length where there is room. A hue colours the
  accents in the spirit of Material 3 — main buttons, chosen options, switches, focus rings, the open conversation in the sidebar, the open settings
  category and the light tint under anything the pointer rests on — buttons, menu items, list entries — take it,
  "New Code Session" shows its label and icon in it with a thin line around, and the
  people's message bubbles a light container tone of it — while background, sidebar, surfaces, text and borders
  stay the plain greys of Black, in light and dark alike. Every choice applies at once and belongs to the person, so it
  follows them to every device and browser.
- **Chat** holds how the conversation behaves, each choice belonging to the person like the appearance:
  "Move sent message to top", off by default: when off, the conversation stays at the bottom after sending and
  follows the answer; when on, the sent message moves to the top with room below for the answer. "Show file changes
  automatically", on by default, lets the changes panel open on its own beside the conversation (see
  [AI web chat](web-chat.md)); when off, it opens only through "N files changed" and only for that conversation.
- **Read aloud** sets the person's reading speed — 1×, 1.25×, 1.5× (the default), 1.75× or 2× — and the voice
  service of the whole chat, chosen in a strip: Device, Gemini, ElevenLabs or OpenAI. Each service keeps its own API
  key, so several can be stored and switched between at will; choosing a service that has a key puts it to use at
  once and marks it with a check, choosing one without shows the field for its key, while the one in use keeps
  reading. The chosen service also transcribes dictation. A key is checked with the service before it is stored; a
  key the service refuses is not stored and the field says so. A key the service accepts but whose account has no
  credit left is stored, with a note that reading aloud starts once credit is added there. Once stored, a key is never shown again — the strip
  only says which service has one, with "Replace key" and "Remove" (which asks first). Anyone signed in may replace
  or remove keys, nobody can read them. Device uses the device's own voice and leaves the keys in place.
  For a service with a key, "Quality" lists its models with what an hour of reading costs about (list prices,
  shown as estimates), and the choice holds for the whole chat because it decides the cost on the shared key;
  ElevenLabs offers only its low-cost Flash model. "Voice" lists six voices of the service; each person picks their
  own, and each voice plays a short sample sentence in the person's language, which is kept so it is paid once.
- **Agents** defines the agents, as described in [Agents in the chat](chat-agents.md).
- **Claude account** signs the container's Claude Code in to a Claude subscription and out again, the
  same login a terminal `/login` creates. Signed in, it shows the account's e-mail, organisation,
  plan and usage, as in the sidebar's account card, with "Switch account", which signs in another account directly, and "Sign out". Signed out, "Sign in with Claude" offers Claude's own sign-in page in a new tab
  and a field for the code that page shows; a wrong code or a failed sign-in says so, and a sign-in in
  progress can be cancelled. Anyone who can open the chat may do this. The account card at the foot of
  the sidebar shows "Not signed in" while no account is signed in and opens this category; it follows
  sign-ins and sign-outs in every open browser. While signed out, a notice above every message input
  says "Claude is not signed in" and its "Sign in" opens this category; while a usage limit is reached,
  it says "Usage limit reached" with the time agents can answer again. Usage figures start over with
  every sign-in and sign-out, so they never show another account's usage.
  Everyone sees the account details until an admin hides them from that person under People, which works
  for admins too, also for oneself. Hidden from someone, the account shows to them only as "Claude account"
  with its session usage: no e-mail, organisation, plan or weekly usage reaches their browser. Switching and
  signing out stay open to everyone, so a friend can sign in their own account. Whoever signed in the current account always sees its details, whatever the
  settings say; once someone else signs in an account or it is signed out, their own setting applies again.
- **People** appears only for admins. It is a table of everyone who has signed in to the chat, with a tick box
  per person for Admin, AI account details and Blocked; a tick takes effect at once. An admin can make others
  admins, take the role away again (also from themselves), show or hide the AI account details for each
  person, and block or unblock anyone but themselves. A blocked person's
  boxes for Admin and AI account details are greyed out, and so is the AI account details box of whoever
  signed in the current account, with "Signed in this account" on hover. A blocked person is no longer an admin, is signed out of every
  open browser at once and is refused by every later sign-in link from the Laravel app. They are not told
  they were blocked: the chat only answers "Unauthorized", as it does for anyone not signed in.
  Becoming an admin is hidden: tapping one's own picture in Profile seven times in quick succession makes
  that person an admin and opens People. Nothing in the chat points to it.
- **Remote control** pairs devices with this chat through the hub, as described in [AI web chat](web-chat.md):
  it shows a one-time pairing link with a copy button and the same link as a QR code, and lists the person's
  paired devices, each of which can be removed; a removed device loses access at once.

There is no save button: every change is stored as it is made — text a moment after typing stops or
on Enter, choices, pictures and files at once — and errors show at the field concerned. "New agent" adds an entry to the list at once; the agent
is created as soon as it has a name and a role, both required. Only deleting an agent asks first. In Profile and Agents
the name comes before the picture.

## Examples

- Jonas picks Inter under Appearance; the whole chat switches to Inter immediately. The next day he
  opens the chat on another computer and it is in Inter there too.
- Jonas lends his Claude account to friends. He taps his picture in Profile seven times, People opens,
  and he removes the AI account details tick for each friend; they now see only "Claude account" and the
  session usage. When one of them misbehaves, Jonas blocks them under People
  and their chat closes on the spot.
- In a conversation, Jonas opens the + menu and chooses "Manage agents"; the Settings window opens
  at Agents, where he gives Peter Peer a new role.
