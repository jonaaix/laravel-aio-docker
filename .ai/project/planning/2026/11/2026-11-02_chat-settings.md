# Chat settings

## Goal

The web chat has one Settings window with categories (Profile, Appearance, Agents) that further
settings can join. Appearance lets each person pick light/dark/system and the app font; both follow
the person to every device. Finished when the sidebar's Settings opens the window, every former
settings path lives in it, and a font change applies at once and survives a reload on another browser.

## Milestones

- [x] Appearance stored per person: `users.color_mode`, `users.font`, `POST /api/users/<id>/appearance`,
      applied on sign-in, cached in the browser against a flash on load
- [x] Fonts: System UI (default), Geist, Inter, Source Sans 3, IBM Plex Sans via `@nuxt/fonts`
- [x] Settings window with categories; Profile and Agents moved in from their own windows; sidebar
      button and "Manage agents" open it; the first-visit name prompt stays its own window
- [x] Feature Book split into four chapters (web chat, people and profile, agents, settings; [`ai-chat-settings`](../../../features/ai/chat-settings.md))

## State

- `SettingsModal` (`app/components/settings/`) opens through `useSettingsWindow().open(category)`
  (`useOverlay`); panels `SettingsProfile`, `SettingsAppearance`, `SettingsAgents` teleport their
  actions into the modal footer (`actionsTarget`), so `UserNameModal` (first-visit prompt only) reuses
  `SettingsProfile` with its own footer.
- Appearance: `users.color_mode` / `users.font`, `POST /api/users/<id>/appearance`; `useAppearance`
  sets `--font-sans` on `<html>` from `FONT_CHOICES` (`shared/utils/fonts.ts`) and caches the font in
  localStorage (`plugins/font.client.ts` applies it before the user loads). The layout adopts the
  person's choice on sign-in; another device's change shows after a reload.
- `users.pin_sent_message` (Appearance → Conversation) switches the page between staying at the
  bottom after sending (default) and moving the sent message to the top.
- Sidebar state is a tinted pill from `sessionState().pillClass`: Working blue, Active green, Paused grey.
- Fonts are self-hosted by `@nuxt/fonts` (`global: true`, so unused ones still get `@font-face`).
- All milestones done.

## Decisions

- Categories on the left, the active category's actions in the modal footer; Appearance applies
  immediately and has no footer.
- Appearance is the person's, not the browser's (UX rule: server owns view choices, the browser caches).

## Open

- None.
