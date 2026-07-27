"use client";

import { useState } from "react";
import { formatMoney, type StatsPayload } from "@/lib/format";

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "good" | "bad" | "default";
}) {
  const cls =
    tone === "good" ? "text-[var(--good)]" :
    tone === "bad" ? "text-[var(--bad)]" :
    "text-[var(--ink)]";
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={cls}>{value}</strong>
    </div>
  );
}

export function StatsReport({ stats, loading }: { stats: StatsPayload | null; loading?: boolean }) {
  const [period, setPeriod] = useState<"day" | "month">("day");

  if (!stats) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm text-[var(--muted)]">
        {loading ? (
          <>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            <span>Đang tải thống kê…</span>
          </>
        ) : (
          "Chưa có dữ liệu"
        )}
      </div>
    );
  }

  const rows = period === "day" ? stats.daily : stats.monthly;
  const totals = rows.reduce(
    (acc, r) => ({
      importedCount: acc.importedCount + r.importedCount,
      importCost: acc.importCost + r.importCost,
      soldCount: acc.soldCount + r.soldCount,
      revenue: acc.revenue + r.revenue,
      profit: acc.profit + r.profit,
    }),
    { importedCount: 0, importCost: 0, soldCount: 0, revenue: 0, profit: 0 },
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-[var(--line)] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Báo cáo</p>
            <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
              Thống kê nhập · lãi
            </h2>
          </div>
          <div className="flex gap-1 rounded-lg border border-[var(--line)] bg-[var(--chip)] p-0.5">
            {(["day", "month"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  period === p
                    ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {p === "day" ? "Theo ngày" : "Theo tháng"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-4 gap-px border-b border-[var(--line)] bg-[var(--line)]">
        <MetricCard label="Xe nhập" value={totals.importedCount} />
        <MetricCard label="Vốn nhập" value={formatMoney(totals.importCost)} />
        <MetricCard label="Xe bán" value={totals.soldCount} />
        <MetricCard
          label="Tổng lãi"
          value={formatMoney(totals.profit)}
          tone={totals.profit > 0 ? "good" : totals.profit < 0 ? "bad" : "default"}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
        <div className="sheet">
          <div className="sheet-head">
            <h3>{period === "day" ? "Theo ngày" : "Theo tháng"}</h3>
            <span>{rows.length} dòng</span>
          </div>
          <div className="sheet-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{period === "day" ? "Ngày" : "Tháng"}</th>
                  <th>Xe nhập</th>
                  <th>Vốn nhập</th>
                  <th>Xe bán</th>
                  <th>Doanh thu</th>
                  <th>Lãi</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      Chưa có dữ liệu
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.key}>
                      <td className="font-medium text-[var(--ink)]">{r.label}</td>
                      <td className="tabular-nums">{r.importedCount || "—"}</td>
                      <td className="tabular-nums">{r.importCost ? formatMoney(r.importCost) : "—"}</td>
                      <td className="tabular-nums">{r.soldCount || "—"}</td>
                      <td className="tabular-nums">{r.revenue ? formatMoney(r.revenue) : "—"}</td>
                      <td
                        className={`tabular-nums ${
                          r.profit > 0 ? "text-[var(--good)]" : r.profit < 0 ? "text-[var(--bad)]" : ""
                        }`}
                      >
                        {r.soldCount ? formatMoney(r.profit) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
