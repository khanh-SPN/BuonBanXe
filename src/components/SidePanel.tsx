"use client";

import { useState } from "react";
import {
  formatDateTime,
  formatMoney,
  type StatsPayload,
  type Vehicle,
  type VehicleStatus,
} from "@/lib/format";

const HOURS_48_MS = 48 * 60 * 60 * 1000;

function canSell(importedAt: string): boolean {
  return Date.now() - new Date(importedAt).getTime() >= HOURS_48_MS;
}

function StatusPill({ status }: { status: VehicleStatus }) {
  const map: Record<VehicleStatus, string> = {
    "Còn hàng": "status-stock",
    "đã đặt cọc": "status-deposit",
    "Đã bán hết": "status-sold",
  };
  return <span className={`status-pill ${map[status]}`}>{status}</span>;
}

function remainPay(v: Vehicle) {
  if (v.agreed_price == null || v.deposit_amount == null) return null;
  return Math.max(0, v.agreed_price - v.deposit_amount);
}

function moneyCell(n: number | null | undefined, tone?: "good" | "bad" | "warn") {
  if (n == null) return <span className="text-[var(--muted)]">—</span>;
  const cls =
    tone === "good" ? "text-[var(--good)]" :
    tone === "bad" ? "text-[var(--bad)]" :
    tone === "warn" ? "text-[var(--warn)]" :
    "text-[var(--ink-soft)]";
  return <span className={`tabular-nums ${cls}`}>{formatMoney(n)}</span>;
}

function NoteCell({ note }: { note: string | null | undefined }) {
  const [open, setOpen] = useState(false);

  if (!note) return <span className="text-[var(--muted)]">—</span>;

  const short = note.length > 28 ? note.slice(0, 28) + "…" : note;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs transition hover:bg-white/5 ${
          open ? "text-[var(--accent)]" : "text-[var(--ink-soft)]"
        }`}
        title={note}
      >
        <span className="shrink-0 text-[10px] opacity-60">📝</span>
        <span className="max-w-[120px] truncate">{short}</span>
        {note.length > 28 && (
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
            className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
          </svg>
        )}
      </button>
      {open && note.length > 28 && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-64 rounded-xl border border-[var(--line)] bg-[var(--chip)] p-3 shadow-xl">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Ghi chú đầy đủ</p>
          <p className="text-xs leading-relaxed text-[var(--ink-soft)]">{note}</p>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "good" | "bad" | "warn" | "default";
}) {
  const cls =
    tone === "good" ? "text-[var(--good)]" :
    tone === "bad" ? "text-[var(--bad)]" :
    tone === "warn" ? "text-[var(--warn)]" :
    "text-[var(--ink)]";
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={cls}>{value}</strong>
    </div>
  );
}

function SummaryTable({
  title,
  rows,
  mode,
}: {
  title: string;
  rows: Vehicle[];
  mode: "active" | "sold";
}) {
  const [showPrices, setShowPrices] = useState(false);

  const colCount = mode === "active" ? 11 : 7;

  return (
    <div className="sheet">
      <div className="sheet-head">
        <h3>{title}</h3>
        <div className="flex items-center gap-2">
          <span>{rows.length} dòng</span>
          {mode === "active" && (
            <button
              type="button"
              onClick={() => setShowPrices(!showPrices)}
              className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[11px] text-[var(--ink-soft)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {showPrices ? "Ẩn giá nhập" : "Hiện giá nhập"}
            </button>
          )}
        </div>
      </div>

      <div className="sheet-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Tên xe</th>
              <th>Giá nhập</th>
              <th>Dự kiến</th>
              {mode === "active" ? (
                <>
                  <th>Giá bán ra</th>
                  <th>Tiền cọc</th>
                  <th>Còn TT</th>
                  <th>Trạng thái</th>
                  <th>Ngày nhập</th>
                  <th>Ngày cọc</th>
                  <th>Ghi chú</th>
                </>
              ) : (
                <>
                  <th>Giá bán</th>
                  <th>Lãi thực</th>
                  <th>Ngày bán</th>
                  <th>Ghi chú</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="empty-row">
                  {mode === "active"
                    ? "Kho trống — dùng nút 📥 Nhập xe để thêm"
                    : "Chưa có xe bán — xem bằng lệnh tổng"}
                </td>
              </tr>
            ) : (
              rows.map((v) => {
                const isSellable = mode === "active" && v.status !== "Đã bán hết" && canSell(v.imported_at);
                const rowClass =
                  v.status === "đã đặt cọc" ? "row-deposit" :
                  v.status === "Đã bán hết" ? "row-sold" : "row-stock";

                return (
                  <tr key={v.id} className={rowClass}>
                    <td>
                      <span className="tabular-nums text-[var(--muted)]">
                        {isSellable && <span className="mr-1 text-[var(--accent)]" title="Đã đủ 48h, có thể bán">⭐</span>}
                        {v.id}
                      </span>
                    </td>
                    <td className="font-medium text-[var(--ink)]">{v.name}</td>
                    <td>
                      {showPrices || mode === "sold"
                        ? moneyCell(v.purchase_price)
                        : <span className="font-mono text-[var(--muted)] tracking-wider">••••</span>}
                    </td>
                    <td>{moneyCell(v.expected_price)}</td>
                    {mode === "active" ? (
                      <>
                        <td>{moneyCell(v.agreed_price)}</td>
                        <td>{moneyCell(v.deposit_amount, "warn")}</td>
                        <td>{moneyCell(remainPay(v))}</td>
                        <td><StatusPill status={v.status} /></td>
                        <td className="nowrap text-[11px] text-[var(--muted)]">{formatDateTime(v.imported_at)}</td>
                        <td className="nowrap text-[11px] text-[var(--muted)]">{formatDateTime(v.deposit_at)}</td>
                        <td><NoteCell note={v.note} /></td>
                      </>
                    ) : (
                      <>
                        <td>{moneyCell(v.actual_price)}</td>
                        <td>{moneyCell(v.profit, (v.profit ?? 0) >= 0 ? "good" : "bad")}</td>
                        <td className="nowrap text-[11px] text-[var(--muted)]">{formatDateTime(v.sold_at)}</td>
                        <td><NoteCell note={v.note} /></td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SidePanel({
  stats,
  loading,
  showSold = false,
}: {
  stats: StatsPayload | null;
  loading?: boolean;
  showSold?: boolean;
}) {
  const [tab, setTab] = useState<"kho" | "ban">("kho");

  if (!stats) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm text-[var(--muted)]">
        {loading ? (
          <>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            <span>Đang tải bảng kho…</span>
          </>
        ) : (
          "Chưa có dữ liệu"
        )}
      </div>
    );
  }

  const activeTab = tab;
  const profitTone =
    stats.today.profit > 0 ? "good" : stats.today.profit < 0 ? "bad" : "default";
  const totalProfitTone =
    stats.totals.profit > 0 ? "good" : stats.totals.profit < 0 ? "bad" : "default";

  return (
    <aside className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-[var(--line)] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              Bảng kho
            </p>
            <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
              Theo dõi tồn kho
            </h2>
          </div>
          <div className="flex gap-1 rounded-lg border border-[var(--line)] bg-[var(--chip)] p-0.5">
            {(["kho", "ban"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === t
                    ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {t === "kho"
                  ? `📦 Đang giữ (${stats.counts.active})`
                  : `✅ Đã bán (${stats.counts.sold})`}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Metric bar */}
      <div className="grid shrink-0 grid-cols-4 gap-px border-b border-[var(--line)] bg-[var(--line)]">
        <MetricCard label="Còn hàng" value={stats.counts.inStock} />
        <MetricCard label="Đã cọc" value={stats.counts.deposited} tone="warn" />
        <MetricCard label="Lãi hôm nay" value={formatMoney(stats.today.profit)} tone={profitTone} />
        <MetricCard label="Tổng lãi" value={formatMoney(stats.totals.profit)} tone={totalProfitTone} />
      </div>

      {/* Summary strip */}
      <div className="shrink-0 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
          <span className="text-[var(--muted)]">
            Tổng nhập:{" "}
            <span className="tabular-nums text-[var(--ink-soft)]">{formatMoney(stats.totals.purchase)}</span>
          </span>
          <span className="text-[var(--muted)]">
            Tổng bán:{" "}
            <span className="tabular-nums text-[var(--ink-soft)]">{formatMoney(stats.totals.sold)}</span>
          </span>
          <span className="text-[var(--muted)]">
            Vốn kho:{" "}
            <span className="tabular-nums text-[var(--ink-soft)]">{formatMoney(stats.totals.capitalInStock)}</span>
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
        {activeTab === "kho" ? (
          <SummaryTable
            title="Xe chưa bán / đang đặt cọc"
            rows={stats.vehicles}
            mode="active"
          />
        ) : (
          <SummaryTable
            title="Xe đã bán hết"
            rows={stats.soldVehicles}
            mode="sold"
          />
        )}
      </div>
    </aside>
  );
}
