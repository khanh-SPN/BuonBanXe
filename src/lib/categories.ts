/** Danh mục chi / thu — dùng chung cho form và server. */
export const EXPENSE_CATEGORIES = [
  "Xăng xe",
  "Thuế nhà",
  "Sửa xe",
  "Bảo hiểm",
  "Ăn uống",
  "Phạt / vé",
  "Mua đồ",
  "Khác",
] as const;

export const INCOME_CATEGORIES = [
  "Làm nhiệm vụ",
  "Lương",
  "Trúng thưởng",
  "Bán đồ",
  "Khác",
] as const;

/** Nhãn tiếng Việt cho từng loại bút toán trong sổ quỹ. */
export const KIND_LABEL: Record<string, string> = {
  car_buy: "Nhập xe",
  car_deposit: "Nhận cọc",
  car_deposit_refund: "Hoàn cọc",
  car_sell: "Bán xe",
  car_tax: "Thuế bán xe",
  expense: "Chi tiêu",
  income: "Thu nhập",
  ig_buy: "Nhập IG",
  ig_sell: "Bán IG",
  loan_out: "Cho vay",
  loan_collect: "Thu nợ",
  borrow_in: "Đi vay",
  borrow_repay: "Trả nợ",
  adjust: "Điều chỉnh",
};
