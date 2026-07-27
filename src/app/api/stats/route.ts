import { NextResponse } from "next/server";
import { getStats } from "@/lib/inventory";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getStats());
}
