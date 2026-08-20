import { allVehicleImages, getVehicleStats } from "./inventory";
import {
  debtTotals,
  getBalances,
  getRate,
  listDebts,
  listIgTrades,
  listLedger,
  todayCashflow,
} from "./wallet";
import type { AppState, VehicleImage } from "./types";

/**
 * node:sqlite trả về row với prototype null — React Server Component từ chối
 * truyền loại object đó xuống client. Chuẩn hoá về object thường trước khi trả.
 */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Một cú fetch duy nhất cho cả trang. */
export function getState(): AppState {
  const stats = getVehicleStats();
  const wallet = getBalances();
  const flow = todayCashflow();
  const totals = debtTotals();

  const images: Record<number, VehicleImage[]> = {};
  for (const img of allVehicleImages()) {
    (images[img.vehicle_id] ??= []).push(img);
  }

  return plain({
    rate: getRate(),
    wallet,
    today: { ...stats.today, ...flow },
    counts: stats.counts,
    totals: stats.totals,
    debts: { list: listDebts(), ...totals },
    vehicles: stats.vehicles,
    soldVehicles: stats.soldVehicles,
    images,
    ledger: listLedger(300),
    igTrades: listIgTrades(200),
    daily: stats.daily,
    monthly: stats.monthly,
  });
}
