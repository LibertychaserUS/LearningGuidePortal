# Study Group AI Tutor plan

The tutor does not run in this phase. The seam is a queue. This plan does not add a model call, a Course Knowledge read, a screen parser, or a stub that pretends to answer.

Branch `cursor/study-group-backend-7481` at `18a1046ec71853f77d1b73eda545526c58964826` stores `aiTutorEnabled` on the Live Session. The schedule form defaults the flag on. The Host can turn it off before the Session starts. The branch has no tutor queue.

## This phase

- Persist the enabled flag with the Live Session.
- Keep a session-scoped queue. An item is the user id, the session id, the text, and the server receipt time.
- Nothing drains the queue. No worker reads it, and no item is deleted by a tutor.
- Do not call a model.
- Do not read Course Knowledge or a Knowledge Release.
- Do not parse or send the shared screen, video, or an Interactive Exhibit.
- Do not change the six-person cap. Do not change token issuance. The queue append is not part of those steps.
- Chat stays in LiveKit. A queue item is not a Chat row, and Chat is not copied into the queue by the room.
- Do not put an AI Tutor participant in the LiveKit room.

## Later phase

A later phase is what would drain the queue. That phase is not this one. When it exists, the PRD behavior is:

- Any current participant may invoke the tutor from the shared LiveKit Chat.
- The prompt and the reply stay in that Chat. Everyone currently in the room sees them. They are not database rows.
- Answers and understanding-check questions use the Related Course AI Tutor configuration and the current student-facing Course Knowledge. Group Study does not pick a Knowledge Release.
- Related Lesson stays optional Session metadata and does not change that grounding.
- Shared screen, video, and Interactive Exhibit pixels are not sent to the tutor. A participant who wants a topic must type it.
- The Host label does not open a private tutor channel. There is no private Chat.

## Out of this plan

- Public persistent Discussion.
- A scored group assessment or a Host-submitted group answer.
- A post-session summary or a reusable group learning record.
- Tutor interpretation of the shared screen.
