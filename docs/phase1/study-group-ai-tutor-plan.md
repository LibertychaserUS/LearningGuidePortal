# Study Group AI Tutor plan

This phase stores whether a Live Session has AI Tutor enabled. It does not call a model, write chat, or put a tutor in the room.

## Later behaviour

When a later phase turns the stored flag on:

- Any current participant may invoke the tutor from the shared LiveKit chat.
- The prompt and the reply stay in that ephemeral chat. They are not database rows.
- Answers and understanding-check questions use the Related Course AI Tutor configuration and the current student-facing Course Knowledge. The Study Group does not pick a Knowledge Release.
- Related Lesson stays optional metadata and does not change grounding.
- Shared screen, video, and exhibits are not sent to the tutor.
- The Host label does not grant a private tutor channel.

## Out of this phase

- No tutor route, prompt, or Knowledge System call from Group Study.
- No tutor control inside the Live Session room.
- No persisted transcript of tutor messages.
