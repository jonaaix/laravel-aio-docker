# Read messages aloud

## Goal

Every message in the web chat can be read aloud with the device's own voices. Finished when the button sits
beside "Copy", picks the voice by the message's language, reads at the person's chosen speed (1.5× by default)
and stops on a second press.

## Milestones

- [x] Reading speed per person: column, API, Appearance setting (1×, 1.25×, 1.5×, 1.75×, 2×)
- [x] Speakable text: message text without code blocks, tool steps, the stop hook line or markdown marks
- [x] Language guess from common words of the six chat languages, the person's chat language for short texts
- [x] Read-aloud button beside "Copy" on every message, turning into a stop button while reading
- [x] Feature Book: web chat and settings chapters

## State

- Built and checked in the browser as the test user: a German answer goes out with a German voice at 1.5×,
  the button turns into a stop button, the speed buttons sit under Appearance. Real voices need a real device.

## Decisions

- Browser speech synthesis rather than a paid voice service: free, instant, works on iPhone (user's call).
- Language comes from the text, not from the chat language, so an English answer gets an English voice (user's call).
- Long texts go out in sentence-sized pieces; some browsers stop a single long utterance after a few seconds.

## Open

- Nothing.
