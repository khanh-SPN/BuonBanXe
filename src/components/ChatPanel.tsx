"use client";

import { useEffect, useRef, useState } from "react";
import type { Vehicle } from "@/lib/db";

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  content: string;
}

// ── Form state types ───────────────────────────────────────────────────────────
interface ImportForm {
  kind: "import";
  name: string;
  price: string;
  note: string;
  useCustomTime: boolean;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
}

interface DepositForm {
  kind: "deposit";
  vehicleId: string;
  deposit: string;
  agreedPrice: string;
  customerName: string;
  note: string;
}

interface SellForm {
  kind: "sell";
  vehicleId: string;
  price: string;
  customerName: string;
  note: string;
  useCustomTime: boolean;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
}

interface CancelDepositForm {
  kind: "cancel_deposit";
  vehicleId: string;
  refund: string;
  note: string;
}

type ActiveForm = ImportForm | DepositForm | SellForm | CancelDepositForm;
type FormKind = ActiveForm["kind"];

// ── Constants ─────────────────────────────────────────────────────────────────
const FORM_META: Record<FormKind, { label: string; icon: string; accentCls: string; borderCls: string; bgStyle: string }> = {
  import:         { label: "Nhập xe vào kho", icon: "📥", accentCls: "text-[var(--good)]",   borderCls: "border-[var(--good)]/30",   bgStyle: "rgba(95,191,143,0.07)"   },
  deposit:        { label: "Đặt cọc xe",      icon: "🟡", accentCls: "text-[var(--warn)]",   borderCls: "border-[var(--warn)]/30",   bgStyle: "rgba(224,176,74,0.07)"   },
  sell:           { label: "Bán xe",           icon: "💰", accentCls: "text-[var(--accent)]", borderCls: "border-[var(--accent)]/30", bgStyle: "rgba(196,112,45,0.07)"   },
  cancel_deposit: { label: "Hủy cọc",          icon: "🔴", accentCls: "text-[var(--bad)]",    borderCls: "border-[var(--bad)]/30",    bgStyle: "rgba(224,113,113,0.07)"  },
};

const INSTANT_CMDS = [
  { label: "📦 Xem kho", cmd: "kho" },
  { label: "📊 Tổng hợp", cmd: "tổng" },
  { label: "🗓 Hôm nay", cmd: "hôm nay" },
  { label: "❓ Help", cmd: "help" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function buildVnAt(date: string, time: string): string {
  // Build ISO from VN local time (UTC+7)
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

function renderMessage(text: string) {
  const lines = text.split("\n");
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        const rendered = parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**"))
            return <strong key={j} className="font-semibold text-[var(--ink)]">{part.slice(2, -2)}</strong>;
          if (part.startsWith("`") && part.endsWith("`"))
            return <code key={j} className="rounded bg-[var(--chip)] px-1.5 py-0.5 font-mono text-[0.82em] text-[var(--accent)]">{part.slice(1, -1)}</code>;
          return <span key={j}>{part}</span>;
        });
        const isBullet = line.trimStart().startsWith("•");
        if (isBullet) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="mt-[3px] shrink-0 text-[10px] text-[var(--accent)] opacity-70">▸</span>
              <span>{rendered}</span>
            </div>
          );
        }
        return <div key={i}>{rendered || <br />}</div>;
      })}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, placeholder, hint, autoFocus, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; autoFocus?: boolean; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
        {required && <span className="text-[var(--accent)] opacity-70">*</span>}
      </label>
      <input
        autoFocus={autoFocus}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] transition"
      />
      {hint && <p className="text-[10px] text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

function NoteField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
        Ghi chú <span className="normal-case tracking-normal text-[var(--muted)] opacity-60">(tuỳ chọn)</span>
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ví dụ: xe độ full, khách quen, xe mới về…"
        rows={2}
        className="resize-none rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] transition"
      />
    </div>
  );
}

function VehicleSelect({
  vehicles,
  value,
  onChange,
  loading,
  forDeposit,
  depositedOnly,
}: {
  vehicles: Vehicle[];
  value: string;
  onChange: (id: string) => void;
  loading: boolean;
  forDeposit?: boolean;
  depositedOnly?: boolean;
}) {
  const filtered = depositedOnly
    ? vehicles.filter((v) => v.status === "đã đặt cọc")
    : vehicles.filter((v) => v.status !== "Đã bán hết");

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
        Chọn xe <span className="text-[var(--accent)] opacity-70">*</span>
      </label>
      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-3 text-sm text-[var(--muted)]">
          <div className="h-3 w-3 animate-spin rounded-full border border-[var(--accent)] border-t-transparent" />
          Đang tải danh sách xe…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-3 text-sm text-[var(--muted)]">
          {depositedOnly ? "Không có xe đang đặt cọc." : forDeposit ? "Không có xe chưa bán." : "Không có xe còn trong kho."}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-0.5">
          {filtered.map((v) => {
            const isSelected = value === String(v.id);
            const statusColor =
              v.status === "đã đặt cọc" ? "text-[var(--warn)]" :
              v.status === "Còn hàng" ? "text-[var(--good)]" : "text-[var(--bad)]";
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onChange(String(v.id))}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                  isSelected
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--ink)]"
                    : "border-[var(--line)] bg-[var(--field)] text-[var(--ink-soft)] hover:border-[var(--line)] hover:bg-white/5"
                }`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${isSelected ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--muted)]"}`}>
                  {isSelected && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="white">
                      <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="font-semibold text-[var(--ink)]">#{v.id} {v.name}</span>
                  <span className={`ml-2 text-[11px] ${statusColor}`}>{v.status}</span>
                  {v.customer_name && (
                    <span className="ml-2 text-[11px] text-[var(--muted)]">👤 {v.customer_name}</span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-[var(--muted)]">
                  nhập {(v.purchase_price / 1_000_000).toLocaleString("vi", { maximumFractionDigits: 1 })}m
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CommandForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  busy,
  vehicles,
  vehiclesLoading,
}: {
  form: ActiveForm;
  onChange: (f: ActiveForm) => void;
  onSubmit: () => void;
  onCancel: () => void;
  busy: boolean;
  vehicles: Vehicle[];
  vehiclesLoading: boolean;
}) {
  const meta = FORM_META[form.kind];

  const isValid =
    form.kind === "import"
      ? !!form.name.trim() && !!form.price.trim()
      : form.kind === "deposit"
        ? !!form.vehicleId && !!form.deposit.trim() && !!form.agreedPrice.trim() && !!form.customerName.trim()
        : form.kind === "sell"
          ? !!form.vehicleId && !!form.price.trim()
          : !!form.vehicleId; // cancel_deposit: only need vehicle

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && isValid && !busy) onSubmit();
    if (e.key === "Escape") onCancel();
  };

  return (
    <div
      className={`mx-1 mb-2 overflow-hidden rounded-xl border ${meta.borderCls}`}
      style={{ background: meta.bgStyle }}
      onKeyDown={handleKey}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">{meta.icon}</span>
          <span className={`text-[13px] font-bold ${meta.accentCls}`}>{meta.label}</span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--ink)]"
          title="Đóng (Esc)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M1 1l12 12M13 1L1 13"/>
          </svg>
        </button>
      </div>

      {/* Fields */}
      <div className="grid gap-3 p-4">

        {/* ── IMPORT ── */}
        {form.kind === "import" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tên xe" value={form.name} onChange={(v) => onChange({ ...form, name: v })} placeholder="GTR, Wave, Dream…" autoFocus required />
              <Field label="Giá nhập" value={form.price} onChange={(v) => onChange({ ...form, price: v })} placeholder="10m · 7.5tr · 150k" hint="+35% dự kiến" required />
            </div>

            {/* Optional datetime */}
            <div className="flex flex-col gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)]/40 p-3">
              <label className="flex cursor-pointer items-center gap-2.5 select-none">
                <span
                  role="checkbox"
                  aria-checked={form.useCustomTime}
                  onClick={() => {
                    const next = !form.useCustomTime;
                    onChange({ ...form, useCustomTime: next, date: next ? todayDate() : form.date, time: next ? nowTime() : form.time });
                  }}
                  className={`flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border-2 transition ${
                    form.useCustomTime ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--muted)]"
                  }`}
                >
                  {form.useCustomTime && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 4l2 2 4-4"/>
                    </svg>
                  )}
                </span>
                <span className="text-[12px] text-[var(--ink-soft)]">Điền thời gian thủ công</span>
                <span className="text-[10px] text-[var(--muted)]">(nhập dữ liệu trễ)</span>
              </label>

              {form.useCustomTime && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Ngày</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => onChange({ ...form, date: e.target.value })}
                      max={todayDate()}
                      className="rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] transition [color-scheme:dark]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Giờ</label>
                    <input
                      type="time"
                      value={form.time}
                      onChange={(e) => onChange({ ...form, time: e.target.value })}
                      className="rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] transition [color-scheme:dark]"
                    />
                  </div>
                </div>
              )}
            </div>

            <NoteField value={form.note} onChange={(v) => onChange({ ...form, note: v })} />
          </>
        )}

        {/* ── DEPOSIT ── */}
        {form.kind === "deposit" && (
          <>
            <VehicleSelect
              vehicles={vehicles}
              value={form.vehicleId}
              onChange={(id) => onChange({ ...form, vehicleId: id })}
              loading={vehiclesLoading}
              forDeposit
            />
            <Field label="Tên khách đặt cọc" value={form.customerName} onChange={(v) => onChange({ ...form, customerName: v })} placeholder="Nguyễn Văn A" required />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tiền cọc" value={form.deposit} onChange={(v) => onChange({ ...form, deposit: v })} placeholder="100k · 500k · 1m" required />
              <Field label="Giá bán ra" value={form.agreedPrice} onChange={(v) => onChange({ ...form, agreedPrice: v })} placeholder="6.5m · 12tr" required />
            </div>
            {form.deposit && form.agreedPrice && (
              <div className="rounded-lg bg-[var(--chip)] px-3 py-2 text-[12px] text-[var(--ink-soft)]">
                Còn thanh toán ≈ <span className="font-semibold text-[var(--warn)]">giá bán − tiền cọc</span>
              </div>
            )}
            <NoteField value={form.note} onChange={(v) => onChange({ ...form, note: v })} />
          </>
        )}

        {/* ── SELL ── */}
        {form.kind === "sell" && (
          <>
            <VehicleSelect
              vehicles={vehicles}
              value={form.vehicleId}
              onChange={(id) => {
                const v = vehicles.find((x) => String(x.id) === id);
                onChange({ ...form, vehicleId: id, customerName: v?.customer_name || form.customerName });
              }}
              loading={vehiclesLoading}
            />
            <Field label="Tên khách mua" value={form.customerName} onChange={(v) => onChange({ ...form, customerName: v })} placeholder="Nguyễn Văn A (để trống nếu giữ khách đã cọc)" />
            <Field label="Giá bán thực tế" value={form.price} onChange={(v) => onChange({ ...form, price: v })} placeholder="13.5m · 9tr · 7m" hint="Xe phải đủ 48 giờ từ lúc nhập" required />

            {/* Optional datetime — cho phép chỉnh giờ bán nếu cần bán trước 48h */}
            <div className="flex flex-col gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)]/40 p-3">
              <label className="flex cursor-pointer items-center gap-2.5 select-none">
                <span
                  role="checkbox"
                  aria-checked={form.useCustomTime}
                  onClick={() => {
                    const next = !form.useCustomTime;
                    onChange({ ...form, useCustomTime: next, date: next ? todayDate() : form.date, time: next ? nowTime() : form.time });
                  }}
                  className={`flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border-2 transition ${
                    form.useCustomTime ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--muted)]"
                  }`}
                >
                  {form.useCustomTime && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 4l2 2 4-4"/>
                    </svg>
                  )}
                </span>
                <span className="text-[12px] text-[var(--ink-soft)]">Điền thời gian bán thủ công</span>
                <span className="text-[10px] text-[var(--muted)]">(vd: bán trước 48h do ghi giờ nhập trễ)</span>
              </label>

              {form.useCustomTime && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Ngày</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => onChange({ ...form, date: e.target.value })}
                      className="rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] transition [color-scheme:dark]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Giờ</label>
                    <input
                      type="time"
                      value={form.time}
                      onChange={(e) => onChange({ ...form, time: e.target.value })}
                      className="rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] transition [color-scheme:dark]"
                    />
                  </div>
                </div>
              )}
            </div>

            <NoteField value={form.note} onChange={(v) => onChange({ ...form, note: v })} />
          </>
        )}

        {/* ── CANCEL DEPOSIT ── */}
        {form.kind === "cancel_deposit" && (
          <>
            <VehicleSelect
              vehicles={vehicles}
              value={form.vehicleId}
              onChange={(id) => onChange({ ...form, vehicleId: id })}
              loading={vehiclesLoading}
              depositedOnly
            />
            {(() => {
              const v = vehicles.find((x) => String(x.id) === form.vehicleId);
              const dep = v?.deposit_amount ?? null;
              const refundNum = form.refund ? parseFloat(form.refund.replace(/[^\d.,]/g, "").replace(",", ".")) : NaN;
              return (
                <>
                  {dep != null && (
                    <div className="rounded-lg border border-[var(--line)] bg-[var(--chip)] px-3 py-2.5 text-[12px]">
                      <span className="text-[var(--muted)]">Tiền cọc ban đầu: </span>
                      <span className="font-semibold text-[var(--warn)]">{(dep / 1_000_000).toLocaleString("vi", { maximumFractionDigits: 3 })}m</span>
                    </div>
                  )}
                  <Field
                    label="Tiền hoàn trả khách"
                    value={form.refund}
                    onChange={(v2) => onChange({ ...form, refund: v2 })}
                    placeholder="0 · 50k · 100k (0 nếu không hoàn)"
                    hint="Để 0 nếu giữ toàn bộ tiền cọc"
                    required={false}
                  />
                  {dep != null && !isNaN(refundNum) && (
                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)]/40 px-3 py-2.5 text-[12px]">
                      <div>
                        <p className="text-[var(--muted)]">Hoàn trả khách</p>
                        <p className="font-semibold text-[var(--bad)]">{(refundNum * 1_000_000).toLocaleString("vi")} đ</p>
                      </div>
                      <div>
                        <p className="text-[var(--muted)]">Mình giữ lại</p>
                        <p className="font-semibold text-[var(--good)]">
                          {Math.max(0, dep - refundNum * 1_000_000).toLocaleString("vi")} đ
                        </p>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
            <NoteField value={form.note} onChange={(v) => onChange({ ...form, note: v })} />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-[var(--line)] px-4 py-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || !isValid}
          className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition ${
            isValid && !busy
              ? "bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-110"
              : "cursor-not-allowed bg-[var(--chip)] text-[var(--muted)] opacity-50"
          }`}
        >
          {busy ? "Đang xử lý…" : `${meta.icon} Xác nhận`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[var(--line)] bg-transparent px-5 py-2.5 text-sm text-[var(--ink-soft)] transition hover:bg-white/5"
        >
          Hủy
        </button>
        <span className="text-[10px] text-[var(--muted)] opacity-60">Ctrl+Enter</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface ChatPanelProps {
  onRefresh?: () => void;
}

export function ChatPanel({ onRefresh }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "bot",
      content:
        "Xin chào! Mình là **bot quản lý kho bán xe**.\n\nDùng các nút bên dưới để nhập lệnh nhanh, hoặc gõ lệnh tự do vào ô chat.\n\n• **📥 Nhập xe** — form điền tên, giá, ghi chú, thời gian\n• **🟡 Đặt cọc** — chọn xe từ danh sách, điền cọc + giá bán\n• **💰 Bán xe** — chọn xe, điền giá bán thực tế\n• **📦 Xem kho** / **📊 Tổng hợp** — xem ngay",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<ActiveForm | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehiclesLoaded, setVehiclesLoaded] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, autoScroll]);

  useEffect(() => {
    if (!busy && !form) inputRef.current?.focus();
  }, [busy, form]);

  const handleScroll = () => {
    if (!chatRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  async function fetchVehicles() {
    if (vehiclesLoaded || vehiclesLoading) return;
    setVehiclesLoading(true);
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const data = await res.json();
        setVehicles([...(data.vehicles ?? []), ...(data.soldVehicles ?? [])]);
        setVehiclesLoaded(true);
      }
    } finally {
      setVehiclesLoading(false);
    }
  }

  function openForm(kind: FormKind) {
    if (kind === "import") {
      setForm({ kind, name: "", price: "", note: "", useCustomTime: false, date: todayDate(), time: nowTime() });
    } else if (kind === "deposit") {
      fetchVehicles();
      setForm({ kind, vehicleId: "", deposit: "", agreedPrice: "", customerName: "", note: "" });
    } else if (kind === "sell") {
      fetchVehicles();
      setForm({ kind, vehicleId: "", price: "", customerName: "", note: "", useCustomTime: false, date: todayDate(), time: nowTime() });
    } else {
      fetchVehicles();
      setForm({ kind: "cancel_deposit", vehicleId: "", refund: "", note: "" });
    }
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: message }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { id: `b-${Date.now()}`, role: "bot", content: data.reply ?? "Có lỗi xảy ra." }]);
      if (data.refresh) {
        onRefresh?.();
        setVehiclesLoaded(false);
        setVehicles([]);
      }
    } catch {
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: "bot", content: "Không kết nối được server." }]);
    } finally {
      setBusy(false);
    }
  }

  async function submitForm() {
    if (!form || busy) return;

    // Build display message for chat
    let displayMsg = "";
    let payload: Record<string, unknown> = {};

    if (form.kind === "import") {
      const at = form.useCustomTime ? buildVnAt(form.date, form.time) : undefined;
      payload = { action: "import", name: form.name, price: form.price, note: form.note || undefined, at };
      displayMsg = `📥 Nhập xe: **${form.name}** · ${form.price}${form.note ? ` · ghi chú: ${form.note}` : ""}${form.useCustomTime ? ` · ${form.date} ${form.time}` : ""}`;
    } else if (form.kind === "deposit") {
      const v = vehicles.find((x) => String(x.id) === form.vehicleId);
      payload = { action: "deposit", vehicleId: Number(form.vehicleId), deposit: form.deposit, agreedPrice: form.agreedPrice, customerName: form.customerName, note: form.note || undefined };
      displayMsg = `🟡 Đặt cọc: **${v ? `#${v.id} ${v.name}` : `#${form.vehicleId}`}** · khách ${form.customerName} · cọc ${form.deposit} · bán ${form.agreedPrice}${form.note ? ` · ghi chú: ${form.note}` : ""}`;
    } else if (form.kind === "sell") {
      const v = vehicles.find((x) => String(x.id) === form.vehicleId);
      const at = form.useCustomTime ? buildVnAt(form.date, form.time) : undefined;
      payload = { action: "sell", vehicleId: Number(form.vehicleId), price: form.price, customerName: form.customerName || undefined, note: form.note || undefined, at };
      displayMsg = `💰 Bán xe: **${v ? `#${v.id} ${v.name}` : `#${form.vehicleId}`}** · ${form.price}${form.customerName ? ` · khách ${form.customerName}` : ""}${form.note ? ` · ghi chú: ${form.note}` : ""}${form.useCustomTime ? ` · ${form.date} ${form.time}` : ""}`;
    } else {
      const v = vehicles.find((x) => String(x.id) === form.vehicleId);
      payload = { action: "cancel_deposit", vehicleId: Number(form.vehicleId), refund: form.refund || "0", note: form.note || undefined };
      displayMsg = `🔴 Hủy cọc: **${v ? `#${v.id} ${v.name}` : `#${form.vehicleId}`}**${form.refund ? ` · hoàn ${form.refund}` : " · không hoàn tiền"}${form.note ? ` · ghi chú: ${form.note}` : ""}`;
    }

    setForm(null);
    setBusy(true);
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: displayMsg }]);

    try {
      const res = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { id: `b-${Date.now()}`, role: "bot", content: data.reply ?? "Có lỗi xảy ra." }]);
      if (data.refresh) {
        onRefresh?.();
        setVehiclesLoaded(false);
        setVehicles([]);
      }
    } catch {
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: "bot", content: "Không kết nối được server." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-[var(--line)] px-5 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Trợ lý kho</p>
            <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">Chat lệnh</h2>
          </div>
          {!autoScroll && (
            <button
              type="button"
              onClick={() => { setAutoScroll(true); bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }}
              className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--chip)] px-3 py-1.5 text-xs text-[var(--ink-soft)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Cuộn xuống ↓
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-5" onScroll={handleScroll}>
        <div className="space-y-2.5">
          {messages.map((m) => (
            <div key={m.id} className={`flex animate-fade-up ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "bot" && (
                <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--chip)] text-[13px]">🤖</div>
              )}
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed sm:max-w-[78%] ${
                m.role === "user"
                  ? "rounded-br-sm bg-[var(--accent)] text-[var(--accent-ink)] shadow-[0_6px_20px_rgba(196,112,45,0.25)]"
                  : "rounded-bl-sm border border-[var(--line)] bg-[var(--panel-2)] text-[var(--ink-soft)]"
              }`}>
                {m.role === "bot" ? renderMessage(m.content) : renderMessage(m.content)}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--chip)] text-[13px]">🤖</div>
              <div className="rounded-2xl rounded-bl-sm border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3.5">
                <span className="inline-flex items-center gap-1.5">
                  {[0, 120, 240].map((delay) => (
                    <span key={delay} className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Bottom area */}
      <div className="shrink-0 border-t border-[var(--line)] bg-[var(--panel)]/80 backdrop-blur">
        {/* Action buttons */}
        <div className="flex flex-wrap gap-1.5 border-b border-[var(--line)] px-4 py-2.5">
          {(["import", "deposit", "cancel_deposit", "sell"] as FormKind[]).map((kind) => {
            const meta = FORM_META[kind];
            const active = form?.kind === kind;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => (active ? setForm(null) : openForm(kind))}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
                    : "border-[var(--line)] bg-[var(--chip)] text-[var(--ink-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                }`}
              >
                {meta.icon} {kind === "import" ? "Nhập xe" : kind === "deposit" ? "Đặt cọc" : kind === "cancel_deposit" ? "Hủy cọc" : "Bán xe"}
              </button>
            );
          })}
          <div className="mx-0.5 w-px self-stretch bg-[var(--line)]" />
          {INSTANT_CMDS.map((q) => (
            <button
              key={q.cmd}
              type="button"
              onClick={() => send(q.cmd)}
              disabled={busy}
              className="shrink-0 rounded-lg border border-[var(--line)] bg-transparent px-3 py-1.5 text-xs text-[var(--muted)] transition hover:bg-[var(--chip)] hover:text-[var(--ink-soft)] disabled:opacity-40"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Command form */}
        {form && (
          <div className="pt-2">
            <CommandForm
              form={form}
              onChange={setForm}
              onSubmit={submitForm}
              onCancel={() => setForm(null)}
              busy={busy}
              vehicles={vehicles}
              vehiclesLoading={vehiclesLoading}
            />
          </div>
        )}

        {/* Text input */}
        {!form && (
          <form className="flex gap-2 px-4 py-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Hoặc gõ lệnh tự do: nhập GTR 10m · tìm GTR · xóa #2"
              className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] transition"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-[var(--accent-ink)] transition hover:brightness-110 disabled:opacity-40"
            >
              Gửi
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
