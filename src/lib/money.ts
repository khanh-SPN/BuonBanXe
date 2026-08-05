/** Parse Vietnam car-trade shorthand: 10m, 100k, 7.5m, 10.000.000, 10 triệu */
export function parseMoney(input: string): number | null {
  const raw = input.trim().toLowerCase().replace(/\s+/g, "").replace(/đ/g, "");
  if (!raw) return null;

  // 10tr / 10triệu / 10 triệu
  const trMatch = raw.match(/^([\d.,]+)(triệu|trieu|tr)$/);
  if (trMatch) {
    const n = parseDecimal(trMatch[1]);
    return n == null ? null : Math.round(n * 1_000_000);
  }

  // 100k / 100ngàn
  const kMatch = raw.match(/^([\d.,]+)(k|ngàn|ngan)$/);
  if (kMatch) {
    const n = parseDecimal(kMatch[1]);
    return n == null ? null : Math.round(n * 1_000);
  }

  // 10m / 10M (million)
  const mMatch = raw.match(/^([\d.,]+)m$/);
  if (mMatch) {
    const n = parseDecimal(mMatch[1]);
    return n == null ? null : Math.round(n * 1_000_000);
  }

  // Plain number: 10000000 or 10.000.000 or 10,000,000
  const digits = raw.replace(/[.,]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

function parseDecimal(s: string): number | null {
  // Support both 7.5 and 7,5
  const normalized = s.includes(",") && !s.includes(".")
    ? s.replace(",", ".")
    : s.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return amount < 0 ? `-${formatted} đ` : `${formatted} đ`;
}

/** Thuế bán xe. Đổi thuế suất chỉ cần sửa đúng dòng này. */
export const TAX_RATE = 0.06;

/** Nhãn hiển thị, ví dụ "6%" — luôn khớp với TAX_RATE. */
export const TAX_LABEL = `${Math.round(TAX_RATE * 100)}%`;

export function expectedSellPrice(purchasePrice: number): number {
  return Math.round(purchasePrice * 1.35);
}

/** Tiền thuế phải nộp khi bán. */
export function saleTax(sellPrice: number): number {
  return Math.round(sellPrice * TAX_RATE);
}

/** Lãi thực = giá bán thực tế − thuế − giá nhập. */
export function actualProfit(purchasePrice: number, sellPrice: number): number {
  return Math.round(sellPrice * (1 - TAX_RATE) - purchasePrice);
}
