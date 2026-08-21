"use client";

import { formatIg, formatVnd, vndFromIg } from "@/lib/money";
import { KIND_LABEL } from "@/lib/categories";
import { formatDateTime } from "@/lib/datetime";
import { countdownText, isSellable, msUntilSellable } from "@/lib/sellable";
import { type Api, Empty, Metric } from "@/components/ui";

export function Overview({
  api,
  onJump,
}: {
  api: Api;
  onJump: (tab: "vehicles" | "ig" | "cash" | "debts" | "report" | "settings") => void;
}) {
  const { state } = api;
  const w = state.wallet;

  const upcoming = state.vehicles
    .map((v) => ({ v, remain: msUntilSellable(v.imported_at) }))
    .filter((x) => x.remain > 0)
    .sort((a, b) => a.remain - b.remain)
    .slice(0, 5);

  const ready = state.vehicles.filter((v) => isSellable(v.imported_at));

  return (
    <div className="grid gap-4">
      {/* Ví */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="card card-pad">
          <p className="eyebrow">Ví IG đang có</p>
          <p className={`tnum mt-1 text-3xl font-semibold ${w.ig < 0 ? "text-[var(--bad)] glow-bad" : "text-[var(--good)] glow-good"}`}>
            {formatIg(w.ig)}
          </p>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            ≈ {formatVnd(vndFromIg(w.ig, state.rate))} theo rate {state.rate}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-[var(--muted)]">
            <span>Số dư đầu: <span className="tnum text-[var(--ink-soft)]">{formatIg(w.openingIg)}</span></span>
            <span>Vào: <span className="tnum text-[var(--good)]">+{formatIg(w.igIn)}</span></span>
            <span>Ra: <span className="tnum text-[var(--bad)]">−{formatIg(w.igOut)}</span></span>
          </div>
        </div>

        <div className="card card-pad">
          <p className="eyebrow">Ví tiền thật</p>
          <p className={`tnum mt-1 text-3xl font-semibold ${w.vnd < 0 ? "text-[var(--bad)] glow-bad" : "text-[var(--ink)] glow-cyan"}`}>
            {formatVnd(w.vnd)}
          </p>
          <p className="mt-1 text-[12px] text-[var(--muted)]">tiền ATM bỏ ra mua IG / thu về khi bán IG</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-[var(--muted)]">
            <span>Số dư đầu: <span className="tnum text-[var(--ink-soft)]">{formatVnd(w.openingVnd)}</span></span>
            <span>Thu: <span className="tnum text-[var(--good)]">+{formatVnd(w.vndIn)}</span></span>
            <span>Chi: <span className="tnum text-[var(--bad)]">−{formatVnd(w.vndOut)}</span></span>
          </div>
        </div>
      </div>

      {/* Nút nhanh */}
      <div className="card flex flex-wrap gap-2 p-3">
        <button type="button" className="btn btn-primary" onClick={() => onJump("vehicles")}>
          🚗 Kho xe
        </button>
        <button type="button" className="btn" onClick={() => onJump("ig")}>
          💱 Mua / bán IG
        </button>
        <button type="button" className="btn" onClick={() => onJump("cash")}>
          🧾 Ghi chi tiêu
        </button>
        <button type="button" className="btn" onClick={() => onJump("debts")}>
          🤝 Nợ
        </button>
        <button type="button" className="btn" onClick={() => onJump("report")}>
          📊 Báo cáo
        </button>
        <button type="button" className="btn" onClick={() => onJump("settings")}>
          ⚙️ Chốt số dư / rate
        </button>
      </div>

      {/* Số liệu */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Xe đang giữ"
          value={`${state.counts.active} xe`}
          sub={`còn hàng ${state.counts.inStock} · đã cọc ${state.counts.deposited}`}
        />
        <Metric label="Vốn nằm ở kho" value={formatIg(state.totals.capitalInStock)} sub="tiền đã bỏ ra mua xe chưa bán" />
        <Metric label="Cọc đang giữ" value={formatIg(state.totals.depositHeld)} tone="warn" sub="tiền khách đã đưa trước" />
        <Metric
          label="Lãi hôm nay"
          value={formatIg(state.today.profit)}
          tone={state.today.profit > 0 ? "good" : state.today.profit < 0 ? "bad" : undefined}
          sub={`bán ${state.today.sold} xe · nhập ${state.today.imported} xe`}
        />
        <Metric label="Người ta nợ mình" value={formatIg(state.debts.owedToMe)} tone="good" />
        <Metric label="Mình nợ người ta" value={formatIg(state.debts.iOwe)} tone="bad" />
        <Metric
          label="Hôm nay vào ví"
          value={formatIg(state.today.igIn)}
          tone="good"
          sub={state.today.vndIn ? `và ${formatVnd(state.today.vndIn)} tiền thật` : undefined}
        />
        <Metric
          label="Hôm nay ra khỏi ví"
          value={formatIg(state.today.igOut)}
          tone="bad"
          sub={state.today.vndOut ? `và ${formatVnd(state.today.vndOut)} tiền thật` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Sổ quỹ gần đây */}
        <div className="card overflow-hidden">
          <div className="card-head">
            <h3>Biến động ví gần đây</h3>
            <button type="button" className="btn btn-sm" onClick={() => onJump("cash")}>
              Xem tất cả
            </button>
          </div>
          {state.ledger.length === 0 ? (
            <Empty>Chưa có giao dịch nào. Ví sẽ tự động ghi khi bạn nhập xe, bán xe, mua bán IG…</Empty>
          ) : (
            <table className="data-table">
              <tbody>
                {state.ledger.slice(0, 10).map((e) => (
                  <tr key={e.id}>
                    <td className="w-[92px] text-[11px] text-[var(--muted)]">{KIND_LABEL[e.kind] ?? e.kind}</td>
                    <td>
                      <span className="text-[var(--ink)]">{e.label}</span>
                      <p className="text-[10.5px] text-[var(--muted)]">{formatDateTime(e.at)}</p>
                    </td>
                    <td className="text-right">
                      {e.ig_delta !== 0 && (
                        <p className={`tnum ${e.ig_delta > 0 ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>
                          {e.ig_delta > 0 ? "+" : "−"}
                          {formatIg(Math.abs(e.ig_delta))}
                        </p>
                      )}
                      {e.vnd_delta !== 0 && (
                        <p className={`tnum text-[11px] ${e.vnd_delta > 0 ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>
                          {e.vnd_delta > 0 ? "+" : "−"}
                          {formatVnd(Math.abs(e.vnd_delta))}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 48 giờ */}
        <div className="card overflow-hidden">
          <div className="card-head">
            <h3>Mốc 48 giờ</h3>
            <span className="text-[11px] text-[var(--muted)]">{ready.length} xe bán được ngay</span>
          </div>
          {upcoming.length === 0 ? (
            <Empty>
              {state.counts.active === 0 ? "Kho đang trống." : "Tất cả xe trong kho đều đã đủ 48 giờ — bán được hết."}
            </Empty>
          ) : (
            <table className="data-table">
              <tbody>
                {upcoming.map(({ v, remain }) => {
                  return (
                    <tr key={v.id}>
                      <td className="text-[var(--ink)]">
                        #{v.id} {v.name}
                      </td>
                      <td className="text-[11px] text-[var(--muted)]">nhập {formatDateTime(v.imported_at)}</td>
                      <td className="tnum text-right text-[var(--warn)]">
                        {countdownText(remain).toLowerCase()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
