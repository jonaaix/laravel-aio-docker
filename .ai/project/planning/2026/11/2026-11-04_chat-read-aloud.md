# Read messages aloud

## Goal

Every message in the web chat can be read aloud, and dictation writes down what was said. Without a voice service the
device's own voices read; with an API key of Google Cloud, Gemini, ElevenLabs or OpenAI stored for the whole chat, a
natural voice reads and the same service transcribes. Finished when the button beside "Copy" reads at the person's
speed, keys can be stored, replaced and removed but never read back, and a message read once plays again without a
new request.

## Milestones

- [x] Reading speed per person, speakable text, language guess, read-aloud button
- [x] Voice service keys per provider, sealed with the chat's signing key, write-only API, stored first and checked after
- [x] Synthesis and transcription for Gemini, ElevenLabs and OpenAI; audio cached on disk
- [x] Quality per service with hourly cost, six voices per service with samples, voice per person
- [x] Google Cloud: Cloud Text-to-Speech (WaveNet, Chirp 3 HD) and Speech-to-Text v1
- [x] Voice list shows only voices that differ in the chat language (question 139b)
- [x] Reading speed as a slider, 0.5×–3× in 0.05× steps
- [x] Feature Book: web chat and settings chapters

## State

- Everything is built. Google Cloud checked with the user's real key through the chat's endpoints: samples in both
  qualities and German/English, a German dictation transcribed correctly. Google Cloud is the active service.
- The user's Google Cloud key was first stored under Gemini; the sealed row was copied to the Google Cloud slot and
  still sits under Gemini, where Google answers 403 API_KEY_SERVICE_BLOCKED.
- Not yet heard with a real key: OpenAI.

## Decisions

- Device speech synthesis as the fallback (user's call).
- One key per service for the whole chat; anyone signed in may replace or remove it, nobody can read it (user's call).
- A key is always stored, then checked; a failed check leaves the service in use unchanged (user's call).
- ElevenLabs' Multilingual tier is left out for its cost (user's call).
- Google Cloud added beside Gemini, not instead of it (user's call, question 138): a Cloud key restricted to
  Text-to-Speech/Speech-to-Text cannot call the Generative Language API behind Gemini.
- Google voices are bound to a language: reading sends the guessed language of the text, dictation the chat language.
  Chirp 3 HD uses the voice names directly; WaveNet has no such names, so each voice maps to the n-th WaveNet voice of
  the same gender in that language, from Google's voice list (cached per language).
- Speech-to-Text v1 takes about one minute of inline audio, so the browser cuts Google dictations into 55-second
  recordings and joins the texts. Only WebM/Ogg Opus is accepted, which every current browser records.
- Google has only one WaveNet voice per gender in German, so the six names collapsed to two sounds. The settings ask
  the server which voices sound alike in the chat language and list only distinct ones (user's call, question 139b);
  the reading language of a message may still differ, where the same gender-and-rank mapping applies.
- The reading speed is saved shortly after the slider stops moving, so arrow keys and dragging don't lose steps.
- The speed is applied when playing (playback rate), because ElevenLabs only allows up to 1.2× itself.
- Long texts go out in pieces so services start playing sooner; the first piece is capped at 120 characters (about one
  sentence), the rest at 400, so the voice starts after roughly a second.

## Open

- Nothing.
