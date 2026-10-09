# Study Group AI Tutor plan

This phase does not call a model. It stores whether a Live Session has AI Tutor enabled, and a session-scoped request queue a later tutor can read. The queue does not change seats, tokens, or chat.

## This phase

- A participant in a live Session with the flag on can enqueue a request.
- The item stores the user id, the session id, the text, and the server receipt time.
- The same client event id returns the original item.
- The item is not a chat row and not a token row.
- Enqueue does not change occupancy, does not issue a token, and does not call a provider.
- There is no drain, no Course Knowledge call, and no understanding-check generation.

## Later behaviour

When a later phase attaches a tutor to the queue:

- Any current participant may invoke the tutor from the shared LiveKit chat.
- The prompt and the reply stay in that ephemeral chat. They are not database rows.
- Answers and understanding-check questions use the Related Course AI Tutor configuration and the current student-facing Course Knowledge. The Study Group does not pick a Knowledge Release.
- Related Lesson stays optional metadata and does not change grounding.
- Shared screen, video, and exhibits are not sent to the tutor.
- The Host label does not grant a private tutor channel.

## Out of this phase

- No model call and no understanding-check generation.
- No tutor control inside the Live Session room.
- No persisted transcript of tutor messages.
