import { NextResponse } from "next/server";
import { handleCommand } from "@/lib/inventory";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json(
      { ok: false, reply: "Bạn chưa nhập lệnh." },
      { status: 400 },
    );
  }

  const result = handleCommand(message);
  return NextResponse.json(result);
}
