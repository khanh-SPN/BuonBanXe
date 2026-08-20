"use client";

import { useState } from "react";
import { formatIg, formatShort, formatVnd } from "@/lib/money";
import type { PeriodStat } from "@/lib/types";
import { type Api, Empty, Metric } from "@/components/ui";

export function ReportTab({ api }: { api: Api }) {
  const { state } = api;
  const [period, setPeriod] = useState<"daily" | "monthly">("daily");
  const rows = period === "daily" ? state.daily : state.monthly;

  const igBought = state.igTrades.filter((t) => t.side === "buy");
  const igSold = state.igTrades.filter((t) => t.side === "sell");
  const vndSpent = igBought.reduce((s, t) => s + t.vnd_amount, 0);
  const vndEarned = igSold.reduce((s, t) => s + t.vnd_amount, 0);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Tổng xe đã bán" value={`${state.counts.sold} xe`} sub={`trên tổng ${state.counts.total} xe`} />
        <Metric label="Tổng tiền bán ra" value={formatIg(state.totals.sold)} />
        <Metric
          label="Tổng lãi thực"
          value={formatIg(state.totals.profit)}
          tone={state.totals.profit >= 0 ? "good" : "bad"}
          sub="đã trừ thuế bán"
        />
        <Metric label="Tổng tiền nhập xe" value={formatIg(state.totals.purchase)} />
        <Metric label="Tiền thật đã bỏ ra mua IG" value={formatVnd(vndSpent)} sub={`${igBought.length} lần nhập IG`} />
        <Metric label="Tiền thật thu về từ bán IG" value={formatVnd(vndEarned)} sub={`${igSold.length} lần bán IG`} />
        <Metric
          label="Chênh lệch tiền thật"
          value={formatVnd(vndEarned - vndSpent)}
          tone={vndEarned - vndSpent >= 0 ? "good" : "bad"}
          sub="thu về − bỏ ra"
        />
        <Metric label="Vốn đang nằm ở kho" value={formatIg(state.totals.capitalInStock)} />
      </div>

      <div className="card overflow-hidden">
        <div className="card-head">
          <h3>Thống kê theo {period === "daily" ? "ngày" : "tháng"}</h3>
          <div className="flex gap-1.5">
            <button
              type="button"
              className={`chip-choice ${period === "daily" ? "on" : ""}`}
              onClick={() => setPeriod("daily")}
            >
              Theo ngày
            </button>
            <button
              type="button"
              className={`chip-choice ${period === "monthly" ? "on" : ""}`}
              onClick={() => setPeriod("monthly")}
            >
              Theo tháng
            </button>
          </div>
        </div>
        {rows.length === 0 ? <Empty>Chưa có dữ liệu.</Empty> : <PeriodTable rows={rows} />}
      </div>
    </div>
  );
}

function PeriodTable({ rows }: { rows: PeriodStat[] }) {
  const maxProfit = Math.max(1, ...rows.map((r) => Math.abs(r.profit)));

  return (
    <div className="max-h-[64vh] overflow-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Kỳ</th>
            <th className="text-right">Nhập</th>
            <th className="text-right">Vốn nhập</th>
            <th className="text-right">Bán</th>
            <th className="text-right">Doanh thu</th>
            <th className="text-right">Lãi thực</th>
            <th className="w-[140px]">Biểu đồ lãi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="nowrap text-[var(--ink)]">{r.label}</td>
              <td className="tnum text-right">{r.importedCount || "—"}</td>
              <td className="tnum text-right text-[var(--muted)]">
                {r.importCost ? formatShort(r.importCost) : "—"}
              </td>
              <td className="tnum text-right">{r.soldCount || "—"}</td>
              <td className="tnum text-right">{r.revenue ? formatShort(r.revenue) : "—"}</td>
              <td className={`tnum text-right ${r.profit > 0 ? "text-[var(--good)]" : r.profit < 0 ? "text-[var(--bad)]" : "text-[var(--muted)]"}`}>
                {r.profit ? formatIg(r.profit) : "—"}
              </td>
              <td>
                <div className="h-2 w-full rounded-full bg-[var(--field)]">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${Math.min(100, (Math.abs(r.profit) / maxProfit) * 100)}%`,
                      background: r.profit >= 0 ? "var(--good)" : "var(--bad)",
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
