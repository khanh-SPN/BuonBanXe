/** Parse optional Vietnamese datetime like "18h31 15/7" or "15/7/2026 18:31" */

const VN_TZ = "+07:00";

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayKey(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export function toLocalDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export function toLocalMonthKey(iso: string): string {
  return toLocalDateKey(iso).slice(0, 7);
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", {
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export function parseViDate(input: string): string | null {
  const parts = input.split(/[\/\-.]/).map((p) => Number(p));
  if (parts.length < 2) return null;
  const [d, m, yRaw] = parts;
  const y = yRaw
    ? yRaw < 100
      ? 2000 + yRaw
      : yRaw
    : new Date().getFullYear();
  if (!d || !m || d > 31 || m > 12) return null;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const check = new Date(`${iso}T12:00:00${VN_TZ}`);
  if (Number.isNaN(check.getTime())) return null;
  return iso;
}

const TIME_RE = /(\d{1,2})\s*[hH:]\s*(\d{2})(?:\s*[mM])?/;
const DATE_RE = /(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/;

/** Extract trailing datetime from command text. Returns clean text + iso timestamp. */
export function peelDateTime(input: string): {
  text: string;
  at: string | null;
} {
  const original = input.trim();
  if (!original) return { text: "", at: null };

  // Patterns (order matters — try time+date and date+time)
  const combos: RegExp[] = [
    // 18h31 15/7/2026 | 18:31 15-7
    new RegExp(
      `\\s+${TIME_RE.source}\\s+${DATE_RE.source}\\s*$`,
      "i",
    ),
    // 15/7 18h31
    new RegExp(
      `\\s+${DATE_RE.source}\\s+${TIME_RE.source}\\s*$`,
      "i",
    ),
    // only date 15/7
    new RegExp(`\\s+${DATE_RE.source}\\s*$`, "i"),
    // only time 18h31 (use hôm nay)
    new RegExp(`\\s+${TIME_RE.source}\\s*$`, "i"),
  ];

  for (let i = 0; i < combos.length; i++) {
    const m = original.match(combos[i]);
    if (!m) continue;

    const sliced = original.slice(0, m.index).trim();
    let hour = 12;
    let minute = 0;
    let dateKey: string | null = null;

    if (i === 0) {
      // time then date
      hour = Number(m[1]);
      minute = Number(m[2]);
      dateKey = parseViDate(`${m[3]}/${m[4]}${m[5] ? `/${m[5]}` : ""}`);
    } else if (i === 1) {
      // date then time
      dateKey = parseViDate(`${m[1]}/${m[2]}${m[3] ? `/${m[3]}` : ""}`);
      hour = Number(m[4]);
      minute = Number(m[5]);
    } else if (i === 2) {
      dateKey = parseViDate(`${m[1]}/${m[2]}${m[3] ? `/${m[3]}` : ""}`);
      hour = 12;
      minute = 0;
    } else {
      hour = Number(m[1]);
      minute = Number(m[2]);
      dateKey = todayKey();
    }

    if (hour > 23 || minute > 59) continue;
    if (!dateKey) continue;

    const isoLocal = `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${VN_TZ}`;
    const ms = new Date(isoLocal).getTime();
    if (Number.isNaN(ms)) continue;

    return { text: sliced, at: new Date(ms).toISOString() };
  }

  return { text: original, at: null };
}
