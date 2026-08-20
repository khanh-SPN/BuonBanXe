/** Luật 48 giờ: xe nhập vào phải giữ đủ 48 tiếng mới bán được. */
export const HOURS_48_MS = 48 * 60 * 60 * 1000;

export function sellableAtIso(importedAt: string): string {
  return new Date(new Date(importedAt).getTime() + HOURS_48_MS).toISOString();
}

/** Còn bao nhiêu mili giây nữa mới bán được (<= 0 là bán được rồi). */
export function msUntilSellable(importedAt: string): number {
  return new Date(importedAt).getTime() + HOURS_48_MS - Date.now();
}

export function isSellable(importedAt: string): boolean {
  return msUntilSellable(importedAt) <= 0;
}

/** "Còn 12h28" */
export function countdownText(ms: number): string {
  const mins = Math.ceil(ms / 60000);
  return `Còn ${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;
}
