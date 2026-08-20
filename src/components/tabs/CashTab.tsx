"use client";

import { useMemo, useState } from "react";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, KIND_LABEL } from "@/lib/categories";
import { formatIg, formatVnd, parseMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";
import {
  type Api,
  DateTimePicker,
  Empty,
  Field,
  MoneyInput,
  Toggle,
  buildAt,
  nowTime,
  todayDate,
} from "@/components/ui";

type LedgerFilter = "all" | "car" | "ig" | "spend" | "debt";

const FILTER_KINDS: Record<LedgerFilter, string[] | null> = {
  all: null,
  car: ["car_buy", "car_deposit", "car_deposit_refund", "car_sell", "car_tax"],
  ig: ["ig_buy", "ig_sell"],
  spend: ["expense", "income", "adjust"],
  debt: ["loan_out", "loan_collect", "borrow_in", "borrow_repay"],
};

export function CashTab({ api }: { api: Api }) {
  const { state } = api;
  const [direction, setDirection] = useState<"expense" | "income">("expense");
  const [wallet, setWallet] = useState<"ig" | "vnd">("ig");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [useTime, setUseTime] = useState(false);
  const [date, setDate] = useState(todayDate());
  const [time, setTime] = useState(nowTime());
  const [filter, setFilter] = useState<LedgerFilter>("all");

  const categories = direction === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const value = parseMoney(amount) ?? 0;
  const valid = value > 0;

  async function submit() {
    const res = await api.send("/api/ledger", {
      direction,
      wallet,
      amount,
      category,
      label: label || undefined,
      note: note || undefined,
      at: useTime ? buildAt(date, time) : undefined,
    });
    if (res.ok) {
      setAmount("");
      setLabel("");
      setNote("");
    }
  }

  const rows = useMemo(() => {
    const kinds = FILTER_KINDS[filter];
    return kinds ? state.ledger.filter((e) => kinds.includes(e.kind)) : state.ledger;
  }, [state.ledger, filter]);

  const spendToday = state.ledger.filter(
    (e) => e.kind === "expense" && e.at.slice(0, 10) === new Date().toISOString().slice(0, 10),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
      <div className="card">
        <div className="card-head">
          <h3>🧾 Ghi một khoản</h3>
        </div>
        <div className="grid gap-3.5 p-4">
          <Toggle
            value={direction}
            onChange={(v) => {
              setDirection(v);
              setCategory(v === "expense" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
            }}
            options={[
              { value: "expense", label: "➖ Chi ra" },
              { value: "income", label: "➕ Thu vào" },
            ]}
          />

          <Field label="Trừ / cộng vào ví nào">
            <Toggle
              value={wallet}
              onChange={setWallet}
              options={[
                { value: "ig", label: "Ví IG" },
                { value: "vnd", label: "Ví tiền thật" },
              ]}
            />
          </Field>

          <MoneyInput
            label="Số tiền"
            value={amount}
            onChange={setAmount}
            unit={wallet === "ig" ? "IG" : "đ"}
            required
            autoFocus
          />

          <Field label="Danh mục">
            <Toggle value={category} onChange={setCategory} options={categories.map((c) => ({ value: c, label: c }))} />
          </Field>

          <Field label="Mô tả" hint="Để trống thì lấy tên danh mục.">
            <input
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="đổ xăng full bình, đóng thuế nhà tuần này…"
            />
          </Field>

          <Field label="Ghi chú">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <DateTimePicker on={useTime} setOn={setUseTime} date={date} setDate={setDate} time={time} setTime={setTime} />

          {valid && (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--chip)] px-3 py-2 text-[12.5px]">
              {direction === "expense" ? "Ví sẽ trừ " : "Ví sẽ cộng "}
              <span className={direction === "expense" ? "text-[var(--bad)]" : "text-[var(--good)]"}>
                {wallet === "ig" ? formatIg(value) : formatVnd(value)}
              </span>
              <span className="text-[var(--muted)]">
                {" "}
                → còn{" "}
                {wallet === "ig"
                  ? formatIg(state.wallet.ig + (direction === "expense" ? -value : value))
                  : formatVnd(state.wallet.vnd + (direction === "expense" ? -value : value))}
              </span>
            </div>
          )}

          <button type="button" className="btn btn-primary" onClick={submit} disabled={!valid || api.busy}>
            {api.busy ? "Đang lưu…" : "Ghi vào sổ"}
          </button>

          <p className="text-[11px] text-[var(--muted)]">
            Hôm nay đã chi {spendToday.length} khoản ·{" "}
            {formatIg(spendToday.reduce((s, e) => s - Math.min(0, e.ig_delta), 0))}
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="card-head flex-wrap">
          <h3>Sổ quỹ</h3>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", "Tất cả"],
                ["car", "Xe"],
                ["ig", "Giao dịch IG"],
                ["spend", "Chi / thu"],
                ["debt", "Nợ"],
              ] as [LedgerFilter, string][]
            ).map(([key, text]) => (
              <button
                key={key}
                type="button"
                className={`chip-choice ${filter === key ? "on" : ""}`}
                onClick={() => setFilter(key)}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <Empty>Chưa có khoản nào trong sổ quỹ.</Empty>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Nội dung</th>
                  <th className="text-right">Ví IG</th>
                  <th className="text-right">Ví tiền thật</th>
                  <th>Thời gian</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap text-[11px] text-[var(--muted)]">{KIND_LABEL[e.kind] ?? e.kind}</td>
                    <td>
                      <span className="text-[var(--ink)]">{e.label}</span>
                      {e.category && <span className="ml-1.5 text-[10.5px] text-[var(--muted)]">· {e.category}</span>}
                      {e.note && <p className="text-[10.5px] text-[var(--muted)]">{e.note}</p>}
                    </td>
                    <td className={`tnum text-right ${e.ig_delta > 0 ? "text-[var(--good)]" : e.ig_delta < 0 ? "text-[var(--bad)]" : "text-[var(--muted)]"}`}>
                      {e.ig_delta === 0 ? "—" : `${e.ig_delta > 0 ? "+" : "−"}${formatIg(Math.abs(e.ig_delta))}`}
                    </td>
                    <td className={`tnum text-right ${e.vnd_delta > 0 ? "text-[var(--good)]" : e.vnd_delta < 0 ? "text-[var(--bad)]" : "text-[var(--muted)]"}`}>
                      {e.vnd_delta === 0 ? "—" : `${e.vnd_delta > 0 ? "+" : "−"}${formatVnd(Math.abs(e.vnd_delta))}`}
                    </td>
                    <td className="nowrap text-[11px] text-[var(--muted)]">{formatDateTime(e.at)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        disabled={api.busy}
                        onClick={() => {
                          const extra = e.ref_type
                            ? "\n\nKhoản này sinh ra từ thao tác khác (xe / IG / nợ) — xoá ở đây chỉ gỡ khỏi ví."
                            : "";
                          if (confirm(`Xoá "${e.label}" khỏi sổ quỹ?${extra}`)) {
                            api.send("/api/ledger", { action: "delete", id: e.id });
                          }
                        }}
                      >
                        Xoá
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
