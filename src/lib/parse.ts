import { parseMoney, parseRate } from "./money";

/** Form gửi lên có thể là số hoặc chuỗi kiểu "10tr" / "200k". */
export function amount(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input) : null;
  if (typeof input === "string") return parseMoney(input);
  return null;
}

export function rate(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) && input > 0 ? input : null;
  if (typeof input === "string") return parseRate(input);
  return null;
}

export function text(input: unknown): string | null {
  return typeof input === "string" && input.trim() ? input.trim() : null;
}

export function id(input: unknown): number | null {
  const n = Number(input);
  return Number.isInteger(n) && n > 0 ? n : null;
}
