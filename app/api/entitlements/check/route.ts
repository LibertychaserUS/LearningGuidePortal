import { NextResponse } from "next/server";
import { currentProductUser } from "@/services/productAuth";
import { checkEntitlement } from "@/services/productStore";

export async function GET(request: Request) {
  const user = await currentProductUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in is required." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const courseId = params.get("courseId") || "";
  if (!courseId) return NextResponse.json({ ok: false, error: "Course is required." }, { status: 400 });
  const deviceValue = params.get("device");
  const device = deviceValue === "pc" || deviceValue === "mobile" ? deviceValue : undefined;
  return NextResponse.json({ ok: true, entitlement: await checkEntitlement(user.id, courseId, device) });
}
