---
id: ai-chat-hub
created: 2026-11-03
tags: [chat, hub, pwa, remote-control, push, mobile]
---

# Orbit, the chat hub

## What is it for?

Orbit is the chat as an app of its own: installable on the phone and the desktop, and able to hold the
chats of several containers at once. A developer looking after several projects switches between them in
one window, and gets told on the phone when an agent has finished. It replaces the earlier separate mobile
app, and it is the same chat — every view and every change of the chat is also Orbit's.

## How does it work?

Orbit lives on its own address on GitHub Pages and can be installed from there to the home screen or the
desktop. It has no server of its own: it talks directly to the chats it is paired with.

### Pairing

On the first start Orbit asks for a chat. In a chat, Settings → Remote control shows a pairing link and the
same link as a QR code (see [AI web chat](web-chat.md)); the link can be pasted into Orbit, the QR code
scanned with Orbit's camera, or the link simply opened, which starts Orbit with it. Orbit asks once whether
to connect to that chat and then opens it. The device is then paired for the person who created the link.
Pairing the same chat again replaces the earlier connection to it.

### Several chats

The chat Orbit shows is chosen at the top of the sidebar, which lists every paired chat by its address, how
many unread conversations each has, "Add server" and "Remove this server". Switching opens the other chat.
Removing a chat also removes the device from that chat. When a chat no longer accepts the device — because it
was removed there — Orbit says so and offers to remove the chat or connect again.

Everything else is the chat itself, with the settings of the person on that chat: language, theme, font and
profile follow that person. Remote control is not part of Orbit's settings; Notifications takes its place.

### Unread

A conversation counts as unread for a person who has written in it when an agent finished an answer there
since the person last opened it — the same people a notification goes to. Unread conversations carry a dot in
the sidebar; the chat switcher shows the count of the other chats, and the app icon shows the total where the
system supports it. A conversation that is open counts as read. Muting does not hide the dot. When a chat is
paired, its existing conversations count as read.

### Notifications and muting

Under Settings → Notifications the person switches notifications on or off for the chat Orbit shows, on this
device. A notification opens Orbit in that chat and conversation. Which answers notify, and who is notified,
is described in [AI web chat](web-chat.md). On the iPhone notifications only work in Orbit installed to the
home screen, and Orbit says so. A conversation can be muted and unmuted from its header; muting stops its
notifications for that person on all their devices.

### Offline and updates

Conversations and lists Orbit has shown stay readable without a connection; a notice says Orbit is offline
and showing saved chats. When a new version of Orbit is available, a notice offers to reload into it.

## Examples

- Jonas pastes the pairing link from his project's chat into Orbit on his Mac, then adds a second project the
  same way. The switcher shows "2" next to the second project while he works in the first; he switches and
  finds the two conversations with new answers marked.
- On the train his iPhone loses the connection; Orbit still shows the conversations he read this morning and
  says it is offline.
