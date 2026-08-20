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

  return {
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
  };
}
