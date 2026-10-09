# Study Group AI Tutor plan

This is a plan for a later phase. It does not add a route, a prompt, a model call, or a stub that pretends to answer.

Branch `cursor/study-group-backend-7481` at `18a1046ec71853f77d1b73eda545526c58964826` stores `aiTutorEnabled` on the Live Session. The schedule form defaults the flag on. The Host can turn it off before the Session starts. The room does not read the flag to call a tutor.

## This phase

- Persist the flag with the Live Session.
- Do not put an AI Tutor participant in the LiveKit room.
- Do not write tutor prompts or replies.
- Do not call the Course AI Tutor or the Knowledge System from Group Study.

## Later phase

When a later phase turns the stored flag on, the behavior is the PRD behavior:

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
