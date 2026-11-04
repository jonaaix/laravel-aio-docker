# Read messages aloud

## Goal

Every message in the web chat can be read aloud. Without a voice service the device's own voices read; with a
Gemini or ElevenLabs API key stored for the whole chat, a natural voice reads instead. Finished when the button
beside "Copy" reads at the person's speed, the key can be stored, replaced and removed but never read back, and a
message read once plays again without a new request.

## Milestones

- [x] Reading speed per person: column, API, setting (1×, 1.25×, 1.5×, 1.75×, 2×)
- [x] Speakable text: message text without code blocks, tool steps, the stop hook line or markdown marks
- [x] Language guess from common words of the six chat languages, the person's chat language for short texts
- [x] Read-aloud button beside "Copy" on every message, turning into a stop button while reading
- [x] Voice service key: settings table, key encrypted with the chat's signing key, write-only API (status, store
      with a check against the provider, remove)
- [x] Server-side synthesis for Gemini (`gemini-3.8-flash-lite-tts`, voice Sulafat) and ElevenLabs
      (`eleven_flash_v2_5`, voice George), audio cached on disk by provider, voice and text
- [x] Client plays the service's audio piece by piece at the person's speed, fetching the next piece while one plays;
      device voices when no key is stored
- [x] Settings category "Read aloud": reading speed (moved from Appearance), provider and key
- [x] Feature Book: web chat and settings chapters

## State

- Everything is built. Checked in the browser as the test user: the Read aloud category, wrong keys for both
  services are refused ("The key was not accepted"; Gemini answers a bad key with 400 API_KEY_INVALID).
- Not yet heard with a real key: the Gemini Interactions request and its audio field, and the ElevenLabs voice,
  follow the providers' documentation of 2026-11-04.

## Decisions

- Device speech synthesis as the fallback: free, instant, works on iPhone (user's call).
- Language comes from the text, not from the chat language, so an English answer gets an English voice (user's call).
  The services detect the language themselves.
- One key for the whole chat; anyone signed in may replace or remove it, nobody can read it (user's call).
- Both Gemini and ElevenLabs, one fixed voice each that speaks all six languages, no voice choice (user's call).
- Generated audio is kept, so reading a message again costs nothing (user's call).
- The key is encrypted with the chat's signing key; if that key changes, the stored key counts as missing. Anyone with
  shell access to the container can still reach it — accepted, told to the user.
- The speed is applied when playing (playback rate), because ElevenLabs only allows up to 1.2× itself.
- Long texts go out in pieces; device voices stop a single long utterance after a few seconds, and services start
  playing sooner with short pieces.

## Open

- Nothing.
