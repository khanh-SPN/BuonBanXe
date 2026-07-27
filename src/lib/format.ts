export function formatMoney(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return amount < 0 ? `-${formatted} đ` : `${formatted} đ`;
}

export function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", {
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export type VehicleStatus = "Còn hàng" | "đã đặt cọc" | "Đã bán hết";

export interface Vehicle {
  id: number;
  name: string;
  purchase_price: number;
  expected_price: number;
  agreed_price: number | null;
  actual_price: number | null;
  status: VehicleStatus;
  customer_name: string | null;
  note: string | null;
  profit: number | null;
  deposit_amount: number | null;
  imported_at: string;
  deposit_at: string | null;
  sold_at: string | null;
}

export interface PeriodStat {
  key: string;
  label: string;
  importedCount: number;
  importCost: number;
  soldCount: number;
  revenue: number;
  profit: number;
}

export interface StatsPayload {
  counts: {
    total: number;
    inStock: number;
    deposited: number;
    sold: number;
    active: number;
  };
  totals: {
    purchase: number;
    sold: number;
    profit: number;
    capitalInStock: number;
  };
  today: {
    date: string;
    imported: number;
    sold: number;
    profit: number;
  };
  /** Chỉ xe chưa bán / đã cọc — dùng cho bảng kho */
  vehicles: Vehicle[];
  /** Chỉ hiện khi tổng hợp */
  soldVehicles: Vehicle[];
  daily: PeriodStat[];
  monthly: PeriodStat[];
}
