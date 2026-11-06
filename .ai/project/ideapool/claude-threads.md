# claude-threads ideas

- 2026-10-31 [agent]: Voice messages in the composer, transcribed before sending (upstream 1.3x has ElevenLabs attachment transcription)
- 2026-11-01 [agent]: Claude Agent SDK (TypeScript) instead of driving the CLI directly — typed events and an in-process permission callback could replace the MCP permission server
- 2026-11-01 [user]: Model and effort chosen per agent (bot), not per conversation — later, if at all
- 2026-11-01 [agent]: Clickable answer options for Claude's questions and a plan approval control (would re-enable AskUserQuestion / plan-mode tools)
- 2026-11-01 [user]: Edit own messages by branching the conversation (CLI can resume at a message and fork); files Claude changed stay as they are — probably not worth it
- 2026-11-02 [agent]: Edit or remove a queued message before Claude picks it up (Claude Code lets you pull it back into the input)
- 2026-11-02 [user]: Show the sender's name above other people's messages in shared conversations (the name is already stored per message)
- 2026-11-02 [user]: Unread pings for people addressed with @ in a conversation
- 2026-11-02 [user]: Agent avatar built from the surprised face plus accessory layers, face colour chosen separately (user designs the accessories)
- 2026-11-02 [agent]: Header heads show at most four and fold the rest into a "+N" bubble, as Google Docs does, once many people and agents take part
- 2026-11-03 [user]: Close the open API: accept cross-origin requests only from the mobile app's address (GitHub Pages) and local dev, later a secret per connected device instead of the bare user id
- 2026-11-03 [agent]: Stamp the last sender on the conversation (like last_answer_at) so the conversation list no longer runs one extra query per row
- 2026-11-04 [user]: "Copy resume command" in the agent menu (`cd <folder> && claude --resume <session>`), since /resume never lists sessions the chat started
