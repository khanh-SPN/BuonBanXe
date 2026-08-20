import { NextResponse } from "next/server";
import { addDebt, deleteDebt, payDebt } from "@/lib/wallet";
import { amount, id, text } from "@/lib/parse";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, message: "Dữ liệu không hợp lệ." }, { status: 400 });

  const debtId = id(body.id);

  if (body.action === "delete") {
    if (!debtId) return NextResponse.json({ ok: false, message: "Thiếu khoản nợ." });
    return NextResponse.json(deleteDebt(debtId));
  }

  if (body.action === "pay") {
    if (!debtId) return NextResponse.json({ ok: false, message: "Thiếu khoản nợ." });
    const value = amount(body.amount);
    if (value == null) return NextResponse.json({ ok: false, message: `Số tiền không đọc được: "${body.amount}"` });
    return NextResponse.json(payDebt(debtId, value, text(body.at) ?? undefined));
  }

  const value = amount(body.igAmount);
  if (value == null) return NextResponse.json({ ok: false, message: `Số tiền không đọc được: "${body.igAmount}"` });

  return NextResponse.json(
    addDebt({
      direction: body.direction === "di_vay" ? "di_vay" : "cho_vay",
      person: String(body.person ?? ""),
      igAmount: value,
      note: text(body.note),
      at: text(body.at) ?? undefined,
    }),
  );
}
