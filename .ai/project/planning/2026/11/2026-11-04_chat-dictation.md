# Dictate messages

## Goal

A microphone in the message input records speech and puts the transcript into the input at the cursor, through the
voice service already stored for reading aloud (ElevenLabs or Gemini). Finished when recording, stopping and the
transcript work, with a small level wave while recording, in Chrome and Safari, and the microphone only shows while a voice service is set up.

## Milestones

- [x] Server: transcription for ElevenLabs (`scribe_v2`) and Gemini (`gemini-3.8-flash` via Interactions), upload route
- [x] Composer: microphone button with recording and transcribing states, transcript inserted at the cursor, errors
      shown at the input
- [x] Feature Book: web chat chapter

## State

- Built. Checked in Chrome as the test user with a spoken test clip as the microphone: ElevenLabs wrote it down
  word for word, the text landed in the input, and the level bars move while recording.
- Not yet tried: Gemini transcription (no key at hand) and Safari's recording format (audio/mp4) on a real iPhone.

## Decisions

- Claude Code's own voice input is not used: it exists only in the terminal and runs on the user's Claude login through
  an internal connection; using it from the chat would mean handling Claude credentials, which Anthropic forbids.
- Sending audio files to the agent was rejected: Claude cannot hear audio, the agent would have to install and run a
  transcriber on every message, and the user could not correct the text first.
- Same stored key as reading aloud; without a key there is no microphone (user's call).
- The transcript goes into the input; the person sends it themselves.

## Open

- Nothing.
