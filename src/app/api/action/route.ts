import { NextResponse } from "next/server";
import { handleAction, type ActionPayload } from "@/lib/inventory";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, reply: "Invalid JSON." }, { status: 400 });
  const result = handleAction(body as ActionPayload);
  return NextResponse.json(result);
}
