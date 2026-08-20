"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatIg, formatVnd, groupDigits, parseMoney } from "@/lib/money";
import type { AppState, VehicleStatus } from "@/lib/types";

// ── Kiểu dùng chung cho các tab ───────────────────────────────────────────────
export interface ApiResult {
  ok: boolean;
  message: string;
  [key: string]: unknown;
}

export interface Api {
  state: AppState;
  busy: boolean;
  refresh: () => Promise<void>;
  notify: (message: string, ok?: boolean) => void;
  /** Gửi lệnh lên server, tự refresh state và hiện toast. */
  send: (url: string, body: unknown) => Promise<ApiResult>;
}

// ── Hiển thị tiền ─────────────────────────────────────────────────────────────
export function Ig({ v, tone }: { v: number | null | undefined; tone?: Tone }) {
  if (v == null) return <span className="text-[var(--muted)]">—</span>;
  return <span className={`tnum ${toneCls(tone, v)}`}>{formatIg(v)}</span>;
}

export function Vnd({ v, tone }: { v: number | null | undefined; tone?: Tone }) {
  if (v == null) return <span className="text-[var(--muted)]">—</span>;
  return <span className={`tnum ${toneCls(tone, v)}`}>{formatVnd(v)}</span>;
}

type Tone = "good" | "bad" | "warn" | "auto" | undefined;

function toneCls(tone: Tone, value: number) {
  if (tone === "auto") return value > 0 ? "text-[var(--good)]" : value < 0 ? "text-[var(--bad)]" : "text-[var(--ink-soft)]";
  if (tone === "good") return "text-[var(--good)]";
  if (tone === "bad") return "text-[var(--bad)]";
  if (tone === "warn") return "text-[var(--warn)]";
  return "text-[var(--ink-soft)]";
}

export function StatusPill({ status }: { status: VehicleStatus }) {
  const map: Record<VehicleStatus, string> = {
    "Còn hàng": "status-stock",
    "đã đặt cọc": "status-deposit",
    "Đã bán hết": "status-sold",
  };
  return <span className={`status-pill ${map[status]}`}>{status}</span>;
}

// ── Ô số liệu ─────────────────────────────────────────────────────────────────
export function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "good" | "bad" | "warn";
}) {
  const cls =
    tone === "good" ? "text-[var(--good)]" :
    tone === "bad" ? "text-[var(--bad)]" :
    tone === "warn" ? "text-[var(--warn)]" :
    "text-[var(--ink)]";
  return (
    <div className="card card-pad">
      <p className="eyebrow">{label}</p>
      <p className={`mt-1.5 text-lg font-semibold tnum ${cls}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

// ── Form ──────────────────────────────────────────────────────────────────────
export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="field-label">
        {label}
        {required && <span className="ml-1 text-[var(--accent)]">*</span>}
      </label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

/** Ô nhập tiền: gõ 10tr / 200k / 1.500.000 đều được, hiện luôn số đã hiểu. */
export function MoneyInput({
  label,
  value,
  onChange,
  unit = "IG",
  placeholder = "10tr · 200k · 1.500.000",
  required,
  autoFocus,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: "IG" | "đ";
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  hint?: ReactNode;
}) {
  const parsed = value.trim() ? parseMoney(value) : null;
  return (
    <Field
      label={label}
      required={required}
      hint={
        value.trim() ? (
          parsed == null ? (
            <span className="text-[var(--bad)]">Không đọc được số này</span>
          ) : (
            <span className="hint-accent">= {groupDigits(parsed)} {unit}</span>
          )
        ) : (
          hint
        )
      }
    >
      <input
        className="input tnum"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </Field>
  );
}

export function Toggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`chip-choice ${value === o.value ? "on" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Ngày giờ thủ công (dùng khi ghi sổ trễ). */
export function DateTimePicker({
  on,
  setOn,
  date,
  setDate,
  time,
  setTime,
  label = "Điền thời gian thủ công",
}: {
  on: boolean;
  setOn: (v: boolean) => void;
  date: string;
  setDate: (v: string) => void;
  time: string;
  setTime: (v: string) => void;
  label?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/40 p-3">
      <label className="flex cursor-pointer select-none items-center gap-2.5">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        <span className="text-[12.5px] text-[var(--ink-soft)]">{label}</span>
      </label>
      {on && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <input type="date" className="input tnum [color-scheme:dark]" value={date} onChange={(e) => setDate(e.target.value)} />
          <input type="time" className="input tnum [color-scheme:dark]" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      )}
    </div>
  );
}

export function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Ghép ngày + giờ theo giờ VN thành ISO để gửi lên server. */
export function buildAt(date: string, time: string): string {
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({
  title,
  icon,
  onClose,
  children,
  footer,
}: {
  title: string;
  icon?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="card-head">
          <h3>
            {icon && <span className="mr-1.5">{icon}</span>}
            {title}
          </h3>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Đóng
          </button>
        </div>
        <div className="grid gap-3.5 p-4">{children}</div>
        {footer && <div className="flex items-center gap-2 border-t border-[var(--line)] p-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-[13px] text-[var(--muted)]">{children}</div>;
}

// ── Ảnh: dán Win+Shift+S rồi Ctrl+V ───────────────────────────────────────────
const MAX_EDGE = 1600;

async function compress(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function PasteZone({
  onUploaded,
  notify,
  hint = "Bấm vào đây rồi Ctrl+V để dán ảnh vừa chụp bằng Win+Shift+S",
}: {
  onUploaded: (path: string) => void;
  notify: (message: string, ok?: boolean) => void;
  hint?: string;
}) {
  const [hot, setHot] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleBlob(blob: Blob) {
    setUploading(true);
    try {
      const dataUrl = await compress(blob);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json();
      if (data.ok && data.path) onUploaded(data.path);
      else notify(data.message ?? "Tải ảnh thất bại.", false);
    } catch {
      notify("Không đọc được ảnh này.", false);
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    async function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (!item) return;
      e.preventDefault();
      const blob = item.getAsFile();
      if (blob) await handleBlob(blob);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`paste-zone ${hot ? "hot" : ""}`}
      onClick={() => fileRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setHot(true);
      }}
      onDragLeave={() => setHot(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setHot(false);
        const file = e.dataTransfer.files?.[0];
        if (file?.type.startsWith("image/")) await handleBlob(file);
      }}
    >
      {uploading ? "Đang tải ảnh lên…" : hint}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) await handleBlob(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Ảnh xe" className="m-auto max-h-[88vh] max-w-full rounded-xl border border-[var(--line)]" />
    </div>
  );
}
