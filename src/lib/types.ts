/** Kiểu dữ liệu dùng chung cho cả server và client (không đụng tới node:sqlite). */

export type VehicleStatus = "Còn hàng" | "đã đặt cọc" | "Đã bán hết";

export interface Vehicle {
  id: number;
  name: string;
  purchase_price: number;
  expected_price: number;
  agreed_price: number | null;
  /** Tổng thu khi bán = trả trước + giá treo. */
  actual_price: number | null;
  /** Phần khách trả trước ngoài chợ — không chịu thuế. */
  upfront_price: number | null;
  status: VehicleStatus;
  customer_name: string | null;
  note: string | null;
  profit: number | null;
  deposit_amount: number | null;
  imported_at: string;
  deposit_at: string | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Mọi khoản tiền vào/ra đều là 1 dòng ở đây — ví IG và ví VND đều tính từ bảng này. */
export type LedgerKind =
  | "car_buy"
  | "car_deposit"
  | "car_deposit_refund"
  | "car_sell"
  | "car_tax"
  | "expense"
  | "income"
  | "ig_buy"
  | "ig_sell"
  | "loan_out"
  | "loan_collect"
  | "borrow_in"
  | "borrow_repay"
  | "adjust";

export type LedgerRefType = "vehicle" | "vehicle_sale" | "ig_trade" | "debt" | null;

export interface LedgerEntry {
  id: number;
  at: string;
  kind: LedgerKind;
  category: string | null;
  label: string;
  ig_delta: number;
  vnd_delta: number;
  ref_type: LedgerRefType;
  ref_id: number | null;
  note: string | null;
  created_at: string;
}

export interface IgTrade {
  id: number;
  side: "buy" | "sell";
  rate: number;
  vnd_amount: number;
  ig_amount: number;
  method: string | null;
  counterparty: string | null;
  note: string | null;
  at: string;
  created_at: string;
}

export interface Debt {
  id: number;
  direction: "cho_vay" | "di_vay";
  person: string;
  ig_amount: number;
  paid_ig: number;
  status: "đang nợ" | "xong";
  note: string | null;
  at: string;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleImage {
  id: number;
  vehicle_id: number;
  path: string;
  created_at: string;
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

export interface AppState {
  rate: number;
  wallet: {
    ig: number;
    vnd: number;
    openingIg: number;
    openingVnd: number;
    igIn: number;
    igOut: number;
    vndIn: number;
    vndOut: number;
  };
  today: {
    date: string;
    imported: number;
    sold: number;
    profit: number;
    igIn: number;
    igOut: number;
    vndIn: number;
    vndOut: number;
    entries: number;
  };
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
    depositHeld: number;
  };
  debts: {
    list: Debt[];
    owedToMe: number;
    iOwe: number;
  };
  vehicles: Vehicle[];
  soldVehicles: Vehicle[];
  images: Record<number, VehicleImage[]>;
  ledger: LedgerEntry[];
  igTrades: IgTrade[];
  daily: PeriodStat[];
  monthly: PeriodStat[];
}
