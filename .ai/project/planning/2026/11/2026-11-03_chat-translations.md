# Chat translations

## Goal

Every text the web chat shows itself goes through the translation layer, in English, German, French,
Dutch, Spanish and Italian. Each person picks the language under Settings → Appearance; without a choice
the browser's language applies, else English. The mobile app follows the person's language. Finished when
every screen reads fully in each language and the choice follows the person to another browser.

## Milestones

- [x] Text extraction in three worktrees (pages/layout/settings, chat components, gallery/composables/utils)
- [x] `@nuxtjs/i18n` installed and configured, Nuxt UI's own texts follow the language
- [x] `users.language` column (migration generated with the dev server stopped), appearance endpoint takes it
- [x] Language picker in Appearance, adopted on load, dates and numbers formatted in the chosen language
- [x] Merge the worktree branches, collect the keys into `en.json`, translations for de, fr, nl, es, it
- [x] Check every screen in German in the browser
- [ ] Tarek: the mobile app takes the person's language

## State

- The chat is translated: 141 keys in `src/agent-chat/i18n/locales/`, language per person (`users.language`,
  migration 0020), picker in Appearance, Nuxt UI texts, `<html lang>` and the formatters follow it.
- Checked in the browser in German (sidebar, settings, conversation, question card, usage meters).
- Open: the mobile app does not take the language yet (Tarek).
- New UI text must go through `t()` with the English text as key and get its five translations.

## Decisions

- `@nuxtjs/i18n` (user approved), `no_prefix` strategy: the language is a person's setting, not part of the URL.
- The English text is the key; a missing translation falls back to the English text.
- Agent answers, names, titles and server error texts stay as written; only the chat's own texts are translated.
- Language names are shown in their own language, like fonts in their own typeface.

## Open

- Nothing.
