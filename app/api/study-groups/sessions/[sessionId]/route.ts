import { signedInUser, studyGroupData, studyGroupFailure, unauthenticated } from "@/modules/group-study/http";
import { studyGroupService } from "@/modules/group-study/runtime";

export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const user = await signedInUser(request);
  if (!user) return unauthenticated();
  const { sessionId } = await context.params;
  try {
    return studyGroupData(await studyGroupService().getSession({ actorUserId: user.id, sessionId }));
  } catch (error) {
    return studyGroupFailure(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const user = await signedInUser(request);
  if (!user) return unauthenticated();
  const { sessionId } = await context.params;
  try {
    const body = await request.json() as { groupId?: string; title?: string };
    return studyGroupData(await studyGroupService().editSession({
      actorUserId: user.id,
      groupId: body.groupId || "",
      sessionId,
      title: body.title
    }));
  } catch (error) {
    return studyGroupFailure(error);
  }
}
