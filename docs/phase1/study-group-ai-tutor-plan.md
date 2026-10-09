# Study Group AI Tutor plan

This phase stores whether a Live Session has AI Tutor enabled. When that flag is on and the Session is live, a participant can queue their own chat text. The server keeps the AI Tutor system prompt. The page, the client bundle, and LiveKit messages do not carry it. Queued text is user data. This phase does not call a model and does not return or render an answer.

## Later behaviour

When a later phase turns the stored flag on:

- Any current participant may invoke the tutor from the shared LiveKit chat.
- The prompt and the reply stay in that ephemeral chat. They are not database rows.
- Answers and understanding-check questions use the Related Course AI Tutor configuration and the current student-facing Course Knowledge. The Study Group does not pick a Knowledge Release.
- Related Lesson stays optional metadata and does not change grounding.
- Shared screen, video, and exhibits are not sent to the tutor.
- The Host label does not grant a private tutor channel.

## Out of this phase

- No model call, no Knowledge System call, and no tutor answer in the room.
- The client does not send a system prompt or a rewritten instruction. `POST /api/study-groups/sessions/:sessionId/ai-tutor` accepts `{ message }` and returns `{ id, queuedAt }`.
- Chat text stays in LiveKit. The queue row is the request, not a tutor transcript.
