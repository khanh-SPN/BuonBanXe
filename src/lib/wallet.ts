import { getDb, type Debt, type IgTrade, type LedgerEntry, type LedgerKind, type LedgerRefType } from "./db";
import { DEFAULT_IG_RATE, formatIg, formatVnd, igFromVnd, vndFromIg } from "./money";
import { nowIso, toLocalDateKey, todayKey } from "./datetime";

// ── Cài đặt (key/value) ───────────────────────────────────────────────────────
export function getSetting(key: string): string | null {
  const row = getDb().prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value);
}

function numSetting(key: string, fallback: number): number {
  const raw = getSetting(key);
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function getRate(): number {
  return numSetting("ig_rate", DEFAULT_IG_RATE);
}

export function setRate(rate: number) {
  setSetting("ig_rate", String(rate));
}

export function getOpening(): { ig: number; vnd: number } {
  return { ig: numSetting("opening_ig", 0), vnd: numSetting("opening_vnd", 0) };
}

// ── Sổ quỹ ────────────────────────────────────────────────────────────────────
export interface NewLedgerEntry {
  kind: LedgerKind;
  label: string;
  igDelta?: number;
  vndDelta?: number;
  category?: string | null;
  refType?: LedgerRefType;
  refId?: number | null;
  note?: string | null;
  at?: string;
}

export function addLedger(entry: NewLedgerEntry): number {
  const ts = nowIso();
  const result = getDb()
    .prepare(
      `INSERT INTO ledger (at, kind, category, label, ig_delta, vnd_delta, ref_type, ref_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      entry.at ?? ts,
      entry.kind,
      entry.category ?? null,
      entry.label,
      Math.round(entry.igDelta ?? 0),
      Math.round(entry.vndDelta ?? 0),
      entry.refType ?? null,
      entry.refId ?? null,
      entry.note ?? null,
      ts,
    );
  return Number(result.lastInsertRowid);
}

export function deleteLedgerByRef(refType: Exclude<LedgerRefType, null>, refId: number) {
  getDb().prepare(`DELETE FROM ledger WHERE ref_type = ? AND ref_id = ?`).run(refType, refId);
}

export function deleteLedgerEntry(id: number): LedgerEntry | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM ledger WHERE id = ?`).get(id) as LedgerEntry | undefined;
  if (!row) return null;
  db.prepare(`DELETE FROM ledger WHERE id = ?`).run(id);
  return row;
}

export function listLedger(limit = 200): LedgerEntry[] {
  return getDb()
    .prepare(`SELECT * FROM ledger ORDER BY at DESC, id DESC LIMIT ?`)
    .all(limit) as LedgerEntry[];
}

export interface Balances {
  ig: number;
  vnd: number;
  openingIg: number;
  openingVnd: number;
  igIn: number;
  igOut: number;
  vndIn: number;
  vndOut: number;
}

export function getBalances(): Balances {
  const opening = getOpening();
  const row = getDb()
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN ig_delta  > 0 THEN ig_delta  ELSE 0 END), 0) AS ig_in,
         COALESCE(SUM(CASE WHEN ig_delta  < 0 THEN -ig_delta ELSE 0 END), 0) AS ig_out,
         COALESCE(SUM(CASE WHEN vnd_delta > 0 THEN vnd_delta ELSE 0 END), 0) AS vnd_in,
         COALESCE(SUM(CASE WHEN vnd_delta < 0 THEN -vnd_delta ELSE 0 END), 0) AS vnd_out
       FROM ledger`,
    )
    .get() as { ig_in: number; ig_out: number; vnd_in: number; vnd_out: number };

  return {
    ig: opening.ig + row.ig_in - row.ig_out,
    vnd: opening.vnd + row.vnd_in - row.vnd_out,
    openingIg: opening.ig,
    openingVnd: opening.vnd,
    igIn: row.ig_in,
    igOut: row.ig_out,
    vndIn: row.vnd_in,
    vndOut: row.vnd_out,
  };
}

/** "Ví tôi đang có X" — chốt lại số dư, tự tính số dư đầu cho khớp mà không đụng sổ quỹ. */
export function reconcileBalance(wallet: "ig" | "vnd", target: number) {
  const b = getBalances();
  if (wallet === "ig") {
    const movement = b.ig - b.openingIg;
    setSetting("opening_ig", String(Math.round(target - movement)));
  } else {
    const movement = b.vnd - b.openingVnd;
    setSetting("opening_vnd", String(Math.round(target - movement)));
  }
  setSetting("opening_at", nowIso());
}

// ── Chi tiêu / thu nhập ───────────────────────────────────────────────────────
export { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./categories";

export function addExpense(opts: {
  direction: "expense" | "income";
  wallet: "ig" | "vnd";
  amount: number;
  category: string;
  label?: string;
  note?: string | null;
  at?: string;
}): { ok: boolean; message: string; id?: number } {
  if (!opts.amount || opts.amount <= 0) return { ok: false, message: "Số tiền phải lớn hơn 0." };
  const sign = opts.direction === "expense" ? -1 : 1;
  const label = opts.label?.trim() || opts.category;
  const id = addLedger({
    kind: opts.direction,
    category: opts.category,
    label,
    igDelta: opts.wallet === "ig" ? sign * opts.amount : 0,
    vndDelta: opts.wallet === "vnd" ? sign * opts.amount : 0,
    note: opts.note ?? null,
    at: opts.at,
  });
  const money = opts.wallet === "ig" ? formatIg(opts.amount) : formatVnd(opts.amount);
  return {
    ok: true,
    id,
    message: `${opts.direction === "expense" ? "Đã ghi chi" : "Đã ghi thu"} ${money} — ${label}`,
  };
}

// ── Mua / bán IG ──────────────────────────────────────────────────────────────
export function listIgTrades(limit = 200): IgTrade[] {
  return getDb()
    .prepare(`SELECT * FROM ig_trades ORDER BY at DESC, id DESC LIMIT ?`)
    .all(limit) as IgTrade[];
}

export function addIgTrade(opts: {
  side: "buy" | "sell";
  rate: number;
  vndAmount?: number | null;
  igAmount?: number | null;
  method?: string | null;
  counterparty?: string | null;
  note?: string | null;
  at?: string;
}): { ok: boolean; message: string; trade?: IgTrade } {
  const rate = opts.rate;
  if (!rate || rate <= 0) return { ok: false, message: "Rate không hợp lệ." };

  let vnd = opts.vndAmount ?? 0;
  let ig = opts.igAmount ?? 0;
  if (vnd > 0 && ig <= 0) ig = igFromVnd(vnd, rate);
  else if (ig > 0 && vnd <= 0) vnd = vndFromIg(ig, rate);
  if (vnd <= 0 || ig <= 0) return { ok: false, message: "Cần nhập số tiền VND hoặc số IG." };

  const ts = nowIso();
  const at = opts.at ?? ts;
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO ig_trades (side, rate, vnd_amount, ig_amount, method, counterparty, note, at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      opts.side,
      rate,
      Math.round(vnd),
      Math.round(ig),
      opts.method?.trim() || null,
      opts.counterparty?.trim() || null,
      opts.note?.trim() || null,
      at,
      ts,
    );
  const id = Number(result.lastInsertRowid);

  addLedger({
    kind: opts.side === "buy" ? "ig_buy" : "ig_sell",
    label:
      opts.side === "buy"
        ? `Nhập IG rate ${rate}${opts.method ? ` (${opts.method})` : ""}`
        : `Bán IG rate ${rate}${opts.method ? ` (${opts.method})` : ""}`,
    category: "Giao dịch IG",
    igDelta: opts.side === "buy" ? ig : -ig,
    vndDelta: opts.side === "buy" ? -vnd : vnd,
    refType: "ig_trade",
    refId: id,
    note: opts.note ?? null,
    at,
  });

  const trade = db.prepare(`SELECT * FROM ig_trades WHERE id = ?`).get(id) as IgTrade;
  return {
    ok: true,
    trade,
    message:
      opts.side === "buy"
        ? `Nhập ${formatIg(ig)} vào ví, trả ${formatVnd(vnd)} (rate ${rate})`
        : `Bán ${formatIg(ig)}, thu về ${formatVnd(vnd)} (rate ${rate})`,
  };
}

export function deleteIgTrade(id: number): { ok: boolean; message: string } {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM ig_trades WHERE id = ?`).get(id) as IgTrade | undefined;
  if (!row) return { ok: false, message: `Không có giao dịch #${id}.` };
  deleteLedgerByRef("ig_trade", id);
  db.prepare(`DELETE FROM ig_trades WHERE id = ?`).run(id);
  return { ok: true, message: `Đã xoá giao dịch IG #${id} và hoàn lại ví.` };
}

// ── Nợ ────────────────────────────────────────────────────────────────────────
export function listDebts(): Debt[] {
  return getDb()
    .prepare(
      `SELECT * FROM debts
       ORDER BY CASE status WHEN 'đang nợ' THEN 0 ELSE 1 END, at DESC, id DESC`,
    )
    .all() as Debt[];
}

export function addDebt(opts: {
  direction: "cho_vay" | "di_vay";
  person: string;
  igAmount: number;
  note?: string | null;
  at?: string;
}): { ok: boolean; message: string; id?: number } {
  if (!opts.person.trim()) return { ok: false, message: "Thiếu tên người vay." };
  if (!opts.igAmount || opts.igAmount <= 0) return { ok: false, message: "Số tiền phải lớn hơn 0." };

  const ts = nowIso();
  const at = opts.at ?? ts;
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO debts (direction, person, ig_amount, paid_ig, status, note, at, created_at, updated_at)
       VALUES (?, ?, ?, 0, 'đang nợ', ?, ?, ?, ?)`,
    )
    .run(opts.direction, opts.person.trim(), Math.round(opts.igAmount), opts.note?.trim() || null, at, ts, ts);
  const id = Number(result.lastInsertRowid);

  addLedger({
    kind: opts.direction === "cho_vay" ? "loan_out" : "borrow_in",
    label:
      opts.direction === "cho_vay"
        ? `Cho ${opts.person.trim()} vay`
        : `Vay của ${opts.person.trim()}`,
    category: "Nợ",
    igDelta: opts.direction === "cho_vay" ? -opts.igAmount : opts.igAmount,
    refType: "debt",
    refId: id,
    note: opts.note ?? null,
    at,
  });

  return {
    ok: true,
    id,
    message:
      opts.direction === "cho_vay"
        ? `Đã cho ${opts.person.trim()} vay ${formatIg(opts.igAmount)}`
        : `Đã vay ${formatIg(opts.igAmount)} của ${opts.person.trim()}`,
  };
}

export function payDebt(id: number, amount: number, at?: string): { ok: boolean; message: string } {
  const db = getDb();
  const debt = db.prepare(`SELECT * FROM debts WHERE id = ?`).get(id) as Debt | undefined;
  if (!debt) return { ok: false, message: `Không có khoản nợ #${id}.` };
  if (debt.status === "xong") return { ok: false, message: "Khoản này đã tất toán." };

  const remain = debt.ig_amount - debt.paid_ig;
  const pay = Math.min(Math.round(amount), remain);
  if (pay <= 0) return { ok: false, message: "Số tiền trả phải lớn hơn 0." };

  const ts = nowIso();
  const paid = debt.paid_ig + pay;
  const done = paid >= debt.ig_amount;

  db.prepare(
    `UPDATE debts SET paid_ig = ?, status = ?, settled_at = ?, updated_at = ? WHERE id = ?`,
  ).run(paid, done ? "xong" : "đang nợ", done ? ts : null, ts, id);

  addLedger({
    kind: debt.direction === "cho_vay" ? "loan_collect" : "borrow_repay",
    label: debt.direction === "cho_vay" ? `${debt.person} trả nợ` : `Trả nợ ${debt.person}`,
    category: "Nợ",
    igDelta: debt.direction === "cho_vay" ? pay : -pay,
    refType: "debt",
    refId: id,
    at: at ?? ts,
  });

  return {
    ok: true,
    message: done
      ? `Đã tất toán khoản nợ với ${debt.person} (${formatIg(debt.ig_amount)}).`
      : `Đã ghi nhận ${formatIg(pay)} — còn lại ${formatIg(debt.ig_amount - paid)}.`,
  };
}

export function deleteDebt(id: number): { ok: boolean; message: string } {
  const db = getDb();
  const debt = db.prepare(`SELECT * FROM debts WHERE id = ?`).get(id) as Debt | undefined;
  if (!debt) return { ok: false, message: `Không có khoản nợ #${id}.` };
  deleteLedgerByRef("debt", id);
  db.prepare(`DELETE FROM debts WHERE id = ?`).run(id);
  return { ok: true, message: `Đã xoá khoản nợ với ${debt.person} và hoàn lại ví.` };
}

export function debtTotals() {
  const debts = listDebts();
  const owedToMe = debts
    .filter((d) => d.direction === "cho_vay" && d.status === "đang nợ")
    .reduce((s, d) => s + (d.ig_amount - d.paid_ig), 0);
  const iOwe = debts
    .filter((d) => d.direction === "di_vay" && d.status === "đang nợ")
    .reduce((s, d) => s + (d.ig_amount - d.paid_ig), 0);
  return { owedToMe, iOwe };
}

/** Chi / thu trong ngày, tính trên cả 2 ví. */
export function todayCashflow() {
  const today = todayKey();
  const rows = listLedger(500).filter((e) => toLocalDateKey(e.at) === today);
  return {
    igIn: rows.filter((r) => r.ig_delta > 0).reduce((s, r) => s + r.ig_delta, 0),
    igOut: rows.filter((r) => r.ig_delta < 0).reduce((s, r) => s - r.ig_delta, 0),
    vndIn: rows.filter((r) => r.vnd_delta > 0).reduce((s, r) => s + r.vnd_delta, 0),
    vndOut: rows.filter((r) => r.vnd_delta < 0).reduce((s, r) => s - r.vnd_delta, 0),
    entries: rows.length,
  };
}
