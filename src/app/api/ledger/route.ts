import { NextResponse } from "next/server";
import { addExpense, deleteLedgerEntry } from "@/lib/wallet";
import { amount, id, text } from "@/lib/parse";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, message: "Dữ liệu không hợp lệ." }, { status: 400 });

  if (body.action === "delete") {
    const entryId = id(body.id);
    if (!entryId) return NextResponse.json({ ok: false, message: "Thiếu khoản cần xoá." });
    const row = deleteLedgerEntry(entryId);
    if (!row) return NextResponse.json({ ok: false, message: "Không tìm thấy khoản này." });
    if (row.ref_type) {
      return NextResponse.json({
        ok: true,
        message: `Đã xoá "${row.label}" khỏi sổ quỹ. Lưu ý: khoản này sinh ra từ ${row.ref_type === "debt" ? "khoản nợ" : row.ref_type === "ig_trade" ? "giao dịch IG" : "xe"}, số liệu bên đó giữ nguyên.`,
      });
    }
    return NextResponse.json({ ok: true, message: `Đã xoá "${row.label}" khỏi sổ quỹ.` });
  }

  const value = amount(body.amount);
  if (value == null) return NextResponse.json({ ok: false, message: `Số tiền không đọc được: "${body.amount}"` });

  return NextResponse.json(
    addExpense({
      direction: body.direction === "income" ? "income" : "expense",
      wallet: body.wallet === "vnd" ? "vnd" : "ig",
      amount: value,
      category: text(body.category) ?? "Khác",
      label: text(body.label) ?? undefined,
      note: text(body.note),
      at: text(body.at) ?? undefined,
    }),
  );
}
