"use client";

import { useState } from "react";
import { formatIg, formatVnd, igFromVnd, parseMoney, parseRate, vndFromIg } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";
import {
  type Api,
  DateTimePicker,
  Empty,
  Field,
  Toggle,
  buildAt,
  nowTime,
  todayDate,
} from "@/components/ui";

const METHODS = ["ATM", "Tiền mặt", "Momo", "Bank khác"];

export function IgTab({ api }: { api: Api }) {
  const { state } = api;
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [rateText, setRateText] = useState(String(state.rate));
  const [vndText, setVndText] = useState("");
  const [igText, setIgText] = useState("");
  const [edited, setEdited] = useState<"vnd" | "ig">("vnd");
  const [method, setMethod] = useState("ATM");
  const [who, setWho] = useState("");
  const [note, setNote] = useState("");
  const [useTime, setUseTime] = useState(false);
  const [date, setDate] = useState(todayDate());
  const [time, setTime] = useState(nowTime());

  const rate = parseRate(rateText) ?? state.rate;
  const typedVnd = parseMoney(vndText) ?? 0;
  const typedIg = parseMoney(igText) ?? 0;

  // Gõ bên nào thì bên kia tự suy ra theo rate.
  const vnd = edited === "vnd" ? typedVnd : vndFromIg(typedIg, rate);
  const ig = edited === "ig" ? typedIg : igFromVnd(typedVnd, rate);
  const valid = rate > 0 && vnd > 0 && ig > 0;

  const igAfter = state.wallet.ig + (side === "buy" ? ig : -ig);
  const vndAfter = state.wallet.vnd + (side === "buy" ? -vnd : vnd);

  async function submit() {
    const res = await api.send("/api/ig", {
      side,
      rate: rateText,
      vndAmount: edited === "vnd" ? vndText : "",
      igAmount: edited === "ig" ? igText : "",
      method,
      counterparty: who || undefined,
      note: note || undefined,
      at: useTime ? buildAt(date, time) : undefined,
    });
    if (res.ok) {
      setVndText("");
      setIgText("");
      setWho("");
      setNote("");
    }
  }

  const trades = state.igTrades;
  const bought = trades.filter((t) => t.side === "buy");
  const sold = trades.filter((t) => t.side === "sell");
  const igBought = bought.reduce((s, t) => s + t.ig_amount, 0);
  const vndSpent = bought.reduce((s, t) => s + t.vnd_amount, 0);
  const igSold = sold.reduce((s, t) => s + t.ig_amount, 0);
  const vndEarned = sold.reduce((s, t) => s + t.vnd_amount, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
      <div className="card">
        <div className="card-head">
          <h3>💱 Giao dịch IG</h3>
          <span className="text-[11px] text-[var(--muted)]">1tr VND = {rate}tr IG</span>
        </div>
        <div className="grid gap-3.5 p-4">
          <Toggle
            value={side}
            onChange={setSide}
            options={[
              { value: "buy", label: "📥 Nhập IG (bỏ tiền thật)" },
              { value: "sell", label: "📤 Bán IG (thu tiền thật)" },
            ]}
          />

          <Field label="Rate" required hint={`1.000.000đ đổi được ${formatIg(igFromVnd(1_000_000, rate))}`}>
            <input className="input tnum" value={rateText} onChange={(e) => setRateText(e.target.value)} placeholder="12.5" />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={side === "buy" ? "Tiền thật bỏ ra" : "Tiền thật thu về"}>
              <input
                className={`input tnum ${edited === "vnd" ? "" : "opacity-70"}`}
                value={edited === "vnd" ? vndText : vnd ? String(vnd) : ""}
                onChange={(e) => {
                  setEdited("vnd");
                  setVndText(e.target.value);
                }}
                placeholder="1tr · 200k"
              />
            </Field>
            <Field label={side === "buy" ? "IG nhận được" : "IG bán ra"}>
              <input
                className={`input tnum ${edited === "ig" ? "" : "opacity-70"}`}
                value={edited === "ig" ? igText : ig ? String(ig) : ""}
                onChange={(e) => {
                  setEdited("ig");
                  setIgText(e.target.value);
                }}
                placeholder="13tr"
              />
            </Field>
          </div>
          <p className="-mt-1 text-[11px] text-[var(--muted)]">
            Gõ 1 trong 2 ô, ô còn lại tự tính theo rate.
          </p>

          <Field label="Hình thức">
            <Toggle value={method} onChange={setMethod} options={METHODS.map((m) => ({ value: m, label: m }))} />
          </Field>

          <Field label="Giao dịch với">
            <input className="input" value={who} onChange={(e) => setWho(e.target.value)} placeholder="tên người / shop" />
          </Field>

          <Field label="Ghi chú">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <DateTimePicker on={useTime} setOn={setUseTime} date={date} setDate={setDate} time={time} setTime={setTime} />

          {valid && (
            <div className="grid gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--chip)] p-3 text-[12.5px]">
              <p className="text-[var(--ink)]">
                {side === "buy"
                  ? `Trả ${formatVnd(vnd)} → nhận ${formatIg(ig)}`
                  : `Bán ${formatIg(ig)} → thu ${formatVnd(vnd)}`}
              </p>
              <p className="text-[var(--muted)]">
                Ví IG: {formatIg(state.wallet.ig)} →{" "}
                <span className={igAfter < 0 ? "text-[var(--bad)]" : "text-[var(--good)]"}>{formatIg(igAfter)}</span>
              </p>
              <p className="text-[var(--muted)]">
                Ví tiền thật: {formatVnd(state.wallet.vnd)} →{" "}
                <span className={vndAfter < 0 ? "text-[var(--bad)]" : "text-[var(--ink)]"}>{formatVnd(vndAfter)}</span>
              </p>
            </div>
          )}

          <button type="button" className="btn btn-primary" onClick={submit} disabled={!valid || api.busy}>
            {api.busy ? "Đang lưu…" : side === "buy" ? "Xác nhận nhập IG" : "Xác nhận bán IG"}
          </button>
        </div>
      </div>

      <div className="grid content-start gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card card-pad">
            <p className="eyebrow">Đã nhập IG</p>
            <p className="tnum mt-1 text-lg font-semibold text-[var(--good)]">{formatIg(igBought)}</p>
            <p className="text-[11px] text-[var(--muted)]">bỏ ra {formatVnd(vndSpent)} · {bought.length} lần</p>
          </div>
          <div className="card card-pad">
            <p className="eyebrow">Đã bán IG</p>
            <p className="tnum mt-1 text-lg font-semibold text-[var(--warn)]">{formatIg(igSold)}</p>
            <p className="text-[11px] text-[var(--muted)]">thu về {formatVnd(vndEarned)} · {sold.length} lần</p>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="card-head">
            <h3>Lịch sử giao dịch IG</h3>
            <span className="text-[11px] text-[var(--muted)]">{trades.length} dòng</span>
          </div>
          {trades.length === 0 ? (
            <Empty>Chưa có giao dịch IG nào.</Empty>
          ) : (
            <div className="max-h-[62vh] overflow-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Loại</th>
                    <th>Rate</th>
                    <th>IG</th>
                    <th>Tiền thật</th>
                    <th>Hình thức</th>
                    <th>Với ai</th>
                    <th>Thời gian</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <span className={`status-pill ${t.side === "buy" ? "status-stock" : "status-deposit"}`}>
                          {t.side === "buy" ? "Nhập IG" : "Bán IG"}
                        </span>
                      </td>
                      <td className="tnum">{t.rate}</td>
                      <td className={`tnum ${t.side === "buy" ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>
                        {t.side === "buy" ? "+" : "−"}
                        {formatIg(t.ig_amount)}
                      </td>
                      <td className={`tnum ${t.side === "buy" ? "text-[var(--bad)]" : "text-[var(--good)]"}`}>
                        {t.side === "buy" ? "−" : "+"}
                        {formatVnd(t.vnd_amount)}
                      </td>
                      <td>{t.method ?? "—"}</td>
                      <td>{t.counterparty ?? "—"}</td>
                      <td className="nowrap text-[11px] text-[var(--muted)]">{formatDateTime(t.at)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          disabled={api.busy}
                          onClick={() => {
                            if (confirm("Xoá giao dịch này và hoàn lại ví?")) {
                              api.send("/api/ig", { action: "delete", id: t.id });
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
    </div>
  );
}
