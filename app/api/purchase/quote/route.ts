import { quoteFailure } from "@/services/paymentHttp";
import { NextResponse } from "next/server";
import { currentProductUser } from "@/services/productAuth";
import { createQuote } from "@/services/productStore";

export async function POST(request: Request) {
  const user = await currentProductUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in is required." }, { status: 401 });
  try {
    const body = await request.json() as { planId?: string; kind?: "purchase" | "trial" | "upgrade" };
    if (body.kind === "upgrade") {
      return NextResponse.json({ ok: false, error: "Upgrade quotes must use /api/subscription/quote." }, { status: 400 });
    }
    const result = await createQuote(user.id, body.planId || "", body.kind === "trial" ? "trial" : "purchase");
    return NextResponse.json({ ok: true, quote: result.quote, plan: result.plan });
  } catch (error) {
    return quoteFailure(error, user.locale);
  }
}
