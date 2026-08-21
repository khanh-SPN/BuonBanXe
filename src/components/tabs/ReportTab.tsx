"use client";

import { useMemo, useState } from "react";
import { TAX_LABEL, formatIg, formatShort, formatVnd, groupDigits } from "@/lib/money";
import { formatDateTime, toLocalDateKey, toLocalMonthKey } from "@/lib/datetime";
import type { PeriodStat, Vehicle } from "@/lib/types";
import { type Api, Empty, Metric, Modal, StatusPill } from "@/components/ui";

type Period = "daily" | "monthly";

export function ReportTab({ api }: { api: Api }) {
  const { state } = api;
  const [period, setPeriod] = useState<Period>("daily");
  const [detail, setDetail] = useState<PeriodStat | null>(null);
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
          <h3>
            Thống kê theo {period === "daily" ? "ngày" : "tháng"}
            <span className="ml-2 font-normal text-[11px] text-[var(--muted)]">
              bấm vào một dòng để xem chi tiết từng xe
            </span>
          </h3>
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
        {rows.length === 0 ? <Empty>Chưa có dữ liệu.</Empty> : <PeriodTable rows={rows} onOpen={setDetail} />}
      </div>

      {detail && (
        <PeriodDetail
          stat={detail}
          period={period}
          vehicles={[...state.vehicles, ...state.soldVehicles]}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function PeriodTable({ rows, onOpen }: { rows: PeriodStat[]; onOpen: (row: PeriodStat) => void }) {
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
            <tr
              key={r.key}
              className="row-click"
              onClick={() => onOpen(r)}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(r);
                }
              }}
              title={`Xem chi tiết ${r.label}`}
            >
              <td className="nowrap text-[var(--ink)]">
                {r.label}
                <span className="ml-1.5 text-[10px] text-[var(--muted)]">›</span>
              </td>
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

// ── Chi tiết một kỳ: xe nào bán, lãi bao nhiêu ────────────────────────────────

/** Phần treo lên chợ = tổng thu − trả trước. Xe bán trước khi có mục trả trước thì treo cả. */
function listedOf(v: Vehicle): number {
  return (v.actual_price ?? 0) - (v.upfront_price ?? 0);
}

/**
 * Thuế suy ngược từ chính số đã chốt lúc bán, không tính lại theo thuế suất
 * hiện tại — có những xe bán hồi thuế còn 5%, tính lại theo 6% là bảng lệch.
 */
function taxOf(v: Vehicle): number {
  return (v.actual_price ?? 0) - v.purchase_price - (v.profit ?? 0);
}

function PeriodDetail({
  stat,
  period,
  vehicles,
  onClose,
}: {
  stat: PeriodStat;
  period: Period;
  vehicles: Vehicle[];
  onClose: () => void;
}) {
  const keyOf = period === "daily" ? toLocalDateKey : toLocalMonthKey;

  const { sold, imported } = useMemo(() => {
    const sold = vehicles
      .filter((v) => v.sold_at && keyOf(v.sold_at) === stat.key)
      .sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0));
    const imported = vehicles
      .filter((v) => keyOf(v.imported_at) === stat.key)
      .sort((a, b) => a.imported_at.localeCompare(b.imported_at));
    return { sold, imported };
  }, [vehicles, keyOf, stat.key]);

  const totalTax = sold.reduce((s, v) => s + taxOf(v), 0);
  const totalUpfront = sold.reduce((s, v) => s + (v.upfront_price ?? 0), 0);
  const totalCost = sold.reduce((s, v) => s + v.purchase_price, 0);

  return (
    <Modal
      title={`Chi tiết ${stat.label}`}
      icon="📅"
      wide
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary flex-1" onClick={onClose}>
          Đóng
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--line)] bg-[var(--chip)] p-3 text-[12px] sm:grid-cols-4">
        <div>
          <p className="text-[var(--muted)]">Bán ra</p>
          <p className="tnum text-[var(--ink)]">{stat.soldCount} xe · {formatIg(stat.revenue)}</p>
        </div>
        <div>
          <p className="text-[var(--muted)]">Vốn của số xe đó</p>
          <p className="tnum text-[var(--ink-soft)]">{formatIg(totalCost)}</p>
        </div>
        <div>
          <p className="text-[var(--muted)]">Thuế đã nộp</p>
          <p className="tnum text-[var(--bad)]">{formatIg(totalTax)}</p>
        </div>
        <div>
          <p className="text-[var(--muted)]">Lãi thực</p>
          <p className={`tnum ${stat.profit >= 0 ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>
            {formatIg(stat.profit)}
          </p>
        </div>
      </div>

      <div>
        <p className="eyebrow mb-1.5">Xe đã bán ({sold.length})</p>
        {sold.length === 0 ? (
          <p className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/40 px-3 py-4 text-center text-[12px] text-[var(--muted)]">
            Không bán xe nào trong kỳ này.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Xe</th>
                  <th className="text-right">Giá nhập</th>
                  <th className="text-right">Trả trước</th>
                  <th className="text-right">Treo chợ</th>
                  <th className="text-right">Tổng thu</th>
                  <th className="text-right">Thuế</th>
                  <th className="text-right">Lãi thực</th>
                </tr>
              </thead>
              <tbody>
                {sold.map((v) => {
                  const upfront = v.upfront_price ?? 0;
                  const listed = listedOf(v);
                  return (
                    <tr key={v.id}>
                      <td className="text-[var(--ink)]">
                        <span className="block max-w-[220px] truncate">{v.name}</span>
                        <span className="text-[10.5px] text-[var(--muted)]">
                          #{v.id} · {formatDateTime(v.sold_at)}
                          {v.customer_name ? ` · ${v.customer_name}` : ""}
                        </span>
                      </td>
                      <td className="tnum nowrap text-right text-[var(--muted)]">{groupDigits(v.purchase_price)}</td>
                      <td className="tnum nowrap text-right text-[var(--warn)]">
                        {upfront > 0 ? groupDigits(upfront) : "—"}
                      </td>
                      <td className="tnum nowrap text-right">{groupDigits(listed)}</td>
                      <td className="tnum nowrap text-right text-[var(--ink)]">{groupDigits(v.actual_price ?? 0)}</td>
                      <td className="tnum nowrap text-right text-[var(--bad)]">{groupDigits(taxOf(v))}</td>
                      <td
                        className={`tnum nowrap text-right font-semibold ${
                          (v.profit ?? 0) > 0
                            ? "text-[var(--good)]"
                            : (v.profit ?? 0) < 0
                              ? "text-[var(--bad)]"
                              : "text-[var(--muted)]"
                        }`}
                      >
                        {groupDigits(v.profit ?? 0)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="total-row">
                  <td className="text-[var(--ink)]">Cộng {sold.length} xe</td>
                  <td className="tnum nowrap text-right">{groupDigits(totalCost)}</td>
                  <td className="tnum nowrap text-right">{totalUpfront > 0 ? groupDigits(totalUpfront) : "—"}</td>
                  <td className="tnum nowrap text-right">{groupDigits(stat.revenue - totalUpfront)}</td>
                  <td className="tnum nowrap text-right">{groupDigits(stat.revenue)}</td>
                  <td className="tnum nowrap text-right text-[var(--bad)]">{groupDigits(totalTax)}</td>
                  <td
                    className={`tnum nowrap text-right font-semibold ${
                      stat.profit >= 0 ? "text-[var(--good)]" : "text-[var(--bad)]"
                    }`}
                  >
                    {groupDigits(stat.profit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {imported.length > 0 && (
        <div>
          <p className="eyebrow mb-1.5">Xe nhập trong kỳ ({imported.length})</p>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Xe</th>
                  <th className="text-right">Giá nhập</th>
                  <th className="text-right">Dự kiến bán</th>
                  <th>Hiện tại</th>
                </tr>
              </thead>
              <tbody>
                {imported.map((v) => (
                  <tr key={v.id}>
                    <td className="text-[var(--ink)]">
                      <span className="block max-w-[220px] truncate">{v.name}</span>
                      <span className="text-[10.5px] text-[var(--muted)]">
                        #{v.id} · {formatDateTime(v.imported_at)}
                      </span>
                    </td>
                    <td className="tnum nowrap text-right">{groupDigits(v.purchase_price)}</td>
                    <td className="tnum nowrap text-right text-[var(--muted)]">{groupDigits(v.expected_price)}</td>
                    <td className="nowrap">
                      <StatusPill status={v.status} />
                    </td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td className="text-[var(--ink)]">Cộng {imported.length} xe</td>
                  <td className="tnum nowrap text-right">{groupDigits(stat.importCost)}</td>
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] text-[var(--muted)]">
        Số tiền trong bảng tính bằng IG. Thuế {TAX_LABEL} chỉ tính trên phần treo chợ — tiền khách trả trước
        không chịu thuế.
      </p>
    </Modal>
  );
}
