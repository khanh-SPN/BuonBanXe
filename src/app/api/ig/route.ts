import { NextResponse } from "next/server";
import { addIgTrade, deleteIgTrade, getRate } from "@/lib/wallet";
import { amount, id, rate, text } from "@/lib/parse";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, message: "Dữ liệu không hợp lệ." }, { status: 400 });

  if (body.action === "delete") {
    const tradeId = id(body.id);
    if (!tradeId) return NextResponse.json({ ok: false, message: "Thiếu giao dịch." });
    return NextResponse.json(deleteIgTrade(tradeId));
  }

  const side = body.side === "sell" ? "sell" : "buy";
  const r = rate(body.rate) ?? getRate();
  const vnd = body.vndAmount === undefined || body.vndAmount === "" ? null : amount(body.vndAmount);
  const ig = body.igAmount === undefined || body.igAmount === "" ? null : amount(body.igAmount);
  if (vnd === null && ig === null) {
    return NextResponse.json({ ok: false, message: "Nhập số tiền VND hoặc số IG." });
  }

  return NextResponse.json(
    addIgTrade({
      side,
      rate: r,
      vndAmount: vnd,
      igAmount: ig,
      method: text(body.method),
      counterparty: text(body.counterparty),
      note: text(body.note),
      at: text(body.at) ?? undefined,
    }),
  );
}
