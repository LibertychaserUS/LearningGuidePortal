import { signedInUser, studyGroupData, studyGroupFailure, unauthenticated } from "@/modules/group-study/http";
import { studyGroupService } from "@/modules/group-study/runtime";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const user = await signedInUser(request);
  if (!user) return unauthenticated();
  const { sessionId } = await context.params;
  try {
    const body = await request.json() as { text?: string; clientEventId?: string };
    return studyGroupData(await studyGroupService().enqueueTutor({
      actorUserId: user.id,
      sessionId,
      text: body.text || "",
      clientEventId: body.clientEventId || ""
    }));
  } catch (error) {
    return studyGroupFailure(error);
  }
}
