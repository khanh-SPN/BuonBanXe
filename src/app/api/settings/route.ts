import { NextResponse } from "next/server";
import { getBalances, getRate, reconcileBalance, setRate } from "@/lib/wallet";
import { formatIg, formatVnd } from "@/lib/money";
import { amount, rate } from "@/lib/parse";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, message: "Dữ liệu không hợp lệ." }, { status: 400 });

  const messages: string[] = [];

  if (body.rate !== undefined && body.rate !== "") {
    const r = rate(body.rate);
    if (r == null) return NextResponse.json({ ok: false, message: `Rate không hợp lệ: "${body.rate}"` });
    setRate(r);
    messages.push(`Rate đổi thành ${r} (1 triệu VND = ${r} triệu IG)`);
  }

  if (body.walletIg !== undefined && body.walletIg !== "") {
    const value = amount(body.walletIg);
    if (value == null) return NextResponse.json({ ok: false, message: `Số dư IG không đọc được: "${body.walletIg}"` });
    reconcileBalance("ig", value);
    messages.push(`Chốt ví IG = ${formatIg(value)}`);
  }

  if (body.walletVnd !== undefined && body.walletVnd !== "") {
    const value = amount(body.walletVnd);
    if (value == null) return NextResponse.json({ ok: false, message: `Số dư VND không đọc được: "${body.walletVnd}"` });
    reconcileBalance("vnd", value);
    messages.push(`Chốt ví tiền thật = ${formatVnd(value)}`);
  }

  if (!messages.length) return NextResponse.json({ ok: false, message: "Không có gì để lưu." });
  return NextResponse.json({ ok: true, message: messages.join(" · "), rate: getRate(), wallet: getBalances() });
}
