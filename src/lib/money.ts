/**
 * Tiền trong game là IG. Tiền thật là VND.
 * Rate: 1 triệu VND đổi được `rate` triệu IG  →  IG = VND × rate.
 * Ví dụ rate 12.5 → bỏ ra 1.000.000đ nhận 12.500.000 IG.
 */

/** Parse kiểu viết tắt: 10m, 100k, 7.5tr, 10.000.000, 12,5tr */
export function parseMoney(input: string): number | null {
  const raw = input.trim().toLowerCase().replace(/\s+/g, "").replace(/đ/g, "").replace(/ig/g, "");
  if (!raw) return null;

  const trMatch = raw.match(/^([\d.,]+)(triệu|trieu|tr)$/);
  if (trMatch) {
    const n = parseDecimal(trMatch[1]);
    return n == null ? null : Math.round(n * 1_000_000);
  }

  const kMatch = raw.match(/^([\d.,]+)(k|ngàn|ngan)$/);
  if (kMatch) {
    const n = parseDecimal(kMatch[1]);
    return n == null ? null : Math.round(n * 1_000);
  }

  const mMatch = raw.match(/^([\d.,]+)m$/);
  if (mMatch) {
    const n = parseDecimal(mMatch[1]);
    return n == null ? null : Math.round(n * 1_000_000);
  }

  const digits = raw.replace(/[.,]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

function parseDecimal(s: string): number | null {
  const normalized = s.includes(",") && !s.includes(".")
    ? s.replace(",", ".")
    : s.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Parse rate: "12.5", "12,5", "13.2" */
export function parseRate(input: string): number | null {
  const n = parseDecimal(input.trim().replace(/\s+/g, ""));
  if (n == null || !Number.isFinite(n) || n <= 0 || n > 1000) return null;
  return n;
}

export function groupDigits(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return amount < 0 ? `-${formatted}` : formatted;
}

/** Tiền trong game. */
export function formatIg(amount: number): string {
  return `${groupDigits(amount)} IG`;
}

/** Tiền thật. */
export function formatVnd(amount: number): string {
  return `${groupDigits(amount)} đ`;
}

/** Rút gọn cho ô số liệu: 12.500.000 → "12,5tr" */
export function formatShort(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `${sign}${trimZero(abs / 1_000_000_000)} tỷ`;
  if (abs >= 1_000_000) return `${sign}${trimZero(abs / 1_000_000)}tr`;
  if (abs >= 1_000) return `${sign}${trimZero(abs / 1_000)}k`;
  return `${sign}${Math.round(abs)}`;
}

function trimZero(n: number): string {
  return n
    .toFixed(n < 10 ? 2 : 1)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
}

export const DEFAULT_IG_RATE = 12.5;

/** Bỏ ra `vnd` đồng ở rate này thì nhận được bao nhiêu IG. */
export function igFromVnd(vnd: number, rate: number): number {
  return Math.round(vnd * rate);
}

/** Bán `ig` ở rate này thì thu về bao nhiêu tiền thật. */
export function vndFromIg(ig: number, rate: number): number {
  if (!rate) return 0;
  return Math.round(ig / rate);
}

/** Thuế bán xe. Đổi thuế suất chỉ cần sửa đúng dòng này. */
export const TAX_RATE = 0.06;

/** Nhãn hiển thị, ví dụ "6%" — luôn khớp với TAX_RATE. */
export const TAX_LABEL = `${Math.round(TAX_RATE * 100)}%`;

/** Tỉ lệ lời dự kiến khi nhập xe. */
export const EXPECTED_MARKUP = 1.35;

export function expectedSellPrice(purchasePrice: number): number {
  return Math.round(purchasePrice * EXPECTED_MARKUP);
}

/**
 * Thuế bán chỉ đánh vào phần **giá treo** trên chợ. Tiền khách trả trước ngoài
 * chợ không đi qua chợ nên không mất thuế.
 */
export function saleTax(listedPrice: number): number {
  return Math.round(listedPrice * TAX_RATE);
}

/** Tổng thu của một lần bán = trả trước + giá treo. */
export function saleTotal(listedPrice: number, upfront = 0): number {
  return Math.round(upfront) + Math.round(listedPrice);
}

/** Lãi thực = trả trước + giá treo − thuế (chỉ trên giá treo) − giá nhập. */
export function actualProfit(purchasePrice: number, listedPrice: number, upfront = 0): number {
  return saleTotal(listedPrice, upfront) - saleTax(listedPrice) - Math.round(purchasePrice);
}
