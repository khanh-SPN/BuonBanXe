"use client";

import { useMemo, useState } from "react";
import type { Vehicle } from "@/lib/types";
import { EXPECTED_MARKUP, TAX_LABEL, formatIg, parseMoney, saleTax } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";
import {
  type Api,
  DateTimePicker,
  Empty,
  Field,
  Ig,
  Lightbox,
  Modal,
  MoneyInput,
  PasteZone,
  StatusPill,
  buildAt,
  nowTime,
  todayDate,
} from "@/components/ui";

const HOURS_48_MS = 48 * 60 * 60 * 1000;

function sellableIn(importedAt: string): { ready: boolean; text: string } {
  const remain = new Date(importedAt).getTime() + HOURS_48_MS - Date.now();
  if (remain <= 0) return { ready: true, text: "Bán được" };
  const mins = Math.ceil(remain / 60000);
  return { ready: false, text: `Còn ${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}` };
}

type Filter = "all" | "stock" | "deposit" | "sold";

export function VehiclesTab({ api }: { api: Api }) {
  const { state } = api;
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<
    | { kind: "import" }
    | { kind: "deposit" | "sell" | "cancel" | "edit" | "images"; vehicle: Vehicle }
    | null
  >(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = [...state.vehicles, ...state.soldVehicles];
    const key = q.trim().toLowerCase();
    return all.filter((v) => {
      if (filter === "stock" && v.status !== "Còn hàng") return false;
      if (filter === "deposit" && v.status !== "đã đặt cọc") return false;
      if (filter === "sold" && v.status !== "Đã bán hết") return false;
      if (key && !v.name.toLowerCase().includes(key) && !String(v.id).includes(key)) return false;
      return true;
    });
  }, [state.vehicles, state.soldVehicles, filter, q]);

  const counts = state.counts;

  return (
    <div className="grid gap-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["all", `Tất cả (${counts.total})`],
              ["stock", `Còn hàng (${counts.inStock})`],
              ["deposit", `Đã cọc (${counts.deposited})`],
              ["sold", `Đã bán (${counts.sold})`],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`chip-choice ${filter === key ? "on" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          <input
            className="input max-w-[240px]"
            placeholder="Tìm tên xe hoặc #id…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="button" className="btn btn-primary" onClick={() => setModal({ kind: "import" })}>
            📥 Nhập xe
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <Empty>Không có xe nào khớp bộ lọc.</Empty>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              images={state.images[v.id] ?? []}
              onZoom={setZoom}
              onAction={(kind) => setModal({ kind, vehicle: v })}
              onUnsell={() => api.send("/api/vehicle", { action: "unsell", id: v.id })}
              onDelete={() => {
                if (confirm(`Xoá hẳn ${v.name} (#${v.id})? Mọi khoản liên quan trong ví cũng bị gỡ.`)) {
                  api.send("/api/vehicle", { action: "delete", id: v.id });
                }
              }}
              busy={api.busy}
            />
          ))}
        </div>
      )}

      {modal?.kind === "import" && <ImportModal api={api} onClose={() => setModal(null)} />}
      {modal?.kind === "deposit" && (
        <DepositModal api={api} vehicle={modal.vehicle} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "sell" && <SellModal api={api} vehicle={modal.vehicle} onClose={() => setModal(null)} />}
      {modal?.kind === "cancel" && (
        <CancelDepositModal api={api} vehicle={modal.vehicle} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "edit" && <EditModal api={api} vehicle={modal.vehicle} onClose={() => setModal(null)} />}
      {modal?.kind === "images" && (
        <ImagesModal api={api} vehicle={modal.vehicle} onClose={() => setModal(null)} onZoom={setZoom} />
      )}
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

// ── Thẻ xe ────────────────────────────────────────────────────────────────────
function VehicleCard({
  vehicle: v,
  images,
  onZoom,
  onAction,
  onUnsell,
  onDelete,
  busy,
}: {
  vehicle: Vehicle;
  images: { id: number; path: string }[];
  onZoom: (src: string) => void;
  onAction: (kind: "deposit" | "sell" | "cancel" | "edit" | "images") => void;
  onUnsell: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const sold = v.status === "Đã bán hết";
  const timer = sellableIn(v.imported_at);
  const remainPay =
    v.agreed_price != null && v.deposit_amount != null ? Math.max(0, v.agreed_price - v.deposit_amount) : null;

  return (
    <div className="card overflow-hidden">
      <div className="flex">
        <button
          type="button"
          className="thumb h-24 w-32 shrink-0 rounded-none border-0 border-r border-[var(--line)]"
          onClick={() => (images[0] ? onZoom(images[0].path) : onAction("images"))}
          title={images[0] ? "Xem ảnh" : "Thêm ảnh"}
        >
          {images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images[0].path} alt={v.name} />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[11px] text-[var(--muted)]">
              + Ảnh
            </span>
          )}
          {images.length > 1 && (
            <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">
              {images.length}
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-[var(--ink)]">{v.name}</p>
              <p className="text-[11px] text-[var(--muted)]">
                #{v.id} · nhập {formatDateTime(v.imported_at)}
              </p>
            </div>
            <StatusPill status={v.status} />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
            <span className="text-[var(--muted)]">Giá nhập</span>
            <span className="text-right"><Ig v={v.purchase_price} /></span>

            {sold ? (
              <>
                <span className="text-[var(--muted)]">Giá bán</span>
                <span className="text-right"><Ig v={v.actual_price} /></span>
                <span className="text-[var(--muted)]">Lãi thực</span>
                <span className="text-right"><Ig v={v.profit} tone="auto" /></span>
                <span className="text-[var(--muted)]">Ngày bán</span>
                <span className="text-right text-[11px] text-[var(--muted)]">{formatDateTime(v.sold_at)}</span>
              </>
            ) : (
              <>
                <span className="text-[var(--muted)]">Dự kiến</span>
                <span className="text-right"><Ig v={v.expected_price} /></span>
                {v.deposit_amount != null && (
                  <>
                    <span className="text-[var(--muted)]">Cọc</span>
                    <span className="text-right"><Ig v={v.deposit_amount} tone="warn" /></span>
                    <span className="text-[var(--muted)]">Còn thu</span>
                    <span className="text-right"><Ig v={remainPay} /></span>
                  </>
                )}
                <span className="text-[var(--muted)]">48 giờ</span>
                <span className={`text-right text-[11.5px] ${timer.ready ? "text-[var(--good)]" : "text-[var(--warn)]"}`}>
                  {timer.text}
                </span>
              </>
            )}
          </div>

          {v.customer_name && (
            <p className="mt-1.5 truncate text-[11.5px] text-[var(--ink-soft)]">👤 {v.customer_name}</p>
          )}
          {v.note && <p className="mt-1 line-clamp-2 text-[11px] text-[var(--muted)]">📝 {v.note}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-[var(--line)] bg-[var(--panel)]/40 p-2">
        {!sold && v.status === "Còn hàng" && (
          <button type="button" className="btn btn-sm" onClick={() => onAction("deposit")} disabled={busy}>
            🟡 Nhận cọc
          </button>
        )}
        {!sold && v.status === "đã đặt cọc" && (
          <button type="button" className="btn btn-sm" onClick={() => onAction("cancel")} disabled={busy}>
            🔴 Huỷ cọc
          </button>
        )}
        {!sold && (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => onAction("sell")} disabled={busy}>
            💰 Bán
          </button>
        )}
        {sold && (
          <button type="button" className="btn btn-sm" onClick={onUnsell} disabled={busy}>
            ↩️ Hoàn tác bán
          </button>
        )}
        <button type="button" className="btn btn-sm" onClick={() => onAction("images")} disabled={busy}>
          🖼 Ảnh
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onAction("edit")} disabled={busy}>
          ✏️ Sửa
        </button>
        <button type="button" className="btn btn-sm btn-danger" onClick={onDelete} disabled={busy}>
          Xoá
        </button>
      </div>
    </div>
  );
}

// ── Nhập xe ───────────────────────────────────────────────────────────────────
function ImportModal({ api, onClose }: { api: Api; onClose: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [useTime, setUseTime] = useState(false);
  const [date, setDate] = useState(todayDate());
  const [time, setTime] = useState(nowTime());

  const parsed = parseMoney(price) ?? 0;
  const valid = !!name.trim() && parsed > 0;

  async function submit() {
    const res = await api.send("/api/vehicle", {
      action: "import",
      name,
      price,
      note: note || undefined,
      images,
      at: useTime ? buildAt(date, time) : undefined,
    });
    if (res.ok) onClose();
  }

  return (
    <Modal
      title="Nhập xe vào kho"
      icon="📥"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-primary flex-1" onClick={submit} disabled={!valid || api.busy}>
            {api.busy ? "Đang lưu…" : "Xác nhận nhập"}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Huỷ
          </button>
        </>
      }
    >
      <Field label="Tên xe" required>
        <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="BMV S1000RR" />
      </Field>
      <MoneyInput label="Giá nhập" value={price} onChange={setPrice} required />
      {parsed > 0 && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--chip)] px-3 py-2 text-[12px]">
          Giá bán dự kiến (+{Math.round((EXPECTED_MARKUP - 1) * 100)}%):{" "}
          <span className="font-semibold text-[var(--accent)]">{formatIg(Math.round(parsed * EXPECTED_MARKUP))}</span>
          <span className="ml-2 text-[var(--muted)]">· ví sẽ trừ {formatIg(parsed)}</span>
        </div>
      )}
      <Field label="Ảnh xe" hint="Chụp bằng Win+Shift+S rồi bấm Ctrl+V — hoặc bấm vào ô để chọn file.">
        <PasteZone onUploaded={(p) => setImages((prev) => [...prev, p])} notify={api.notify} />
      </Field>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((p) => (
            <div key={p} className="thumb h-16 w-24">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="ảnh xe" />
              <button
                type="button"
                className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-[11px] text-white"
                onClick={() => setImages((prev) => prev.filter((x) => x !== p))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <Field label="Ghi chú">
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="xe độ full, mới về…" />
      </Field>
      <DateTimePicker on={useTime} setOn={setUseTime} date={date} setDate={setDate} time={time} setTime={setTime} />
    </Modal>
  );
}

// ── Nhận cọc ──────────────────────────────────────────────────────────────────
function DepositModal({ api, vehicle, onClose }: { api: Api; vehicle: Vehicle; onClose: () => void }) {
  const [deposit, setDeposit] = useState("");
  const [agreed, setAgreed] = useState("");
  const [customer, setCustomer] = useState("");
  const [note, setNote] = useState("");

  const d = parseMoney(deposit) ?? 0;
  const a = parseMoney(agreed) ?? 0;
  const valid = !!customer.trim() && d > 0 && a >= d;

  async function submit() {
    const res = await api.send("/api/vehicle", {
      action: "deposit",
      id: vehicle.id,
      deposit,
      agreedPrice: agreed,
      customerName: customer,
      note: note || undefined,
    });
    if (res.ok) onClose();
  }

  return (
    <Modal
      title={`Nhận cọc — ${vehicle.name} (#${vehicle.id})`}
      icon="🟡"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-primary flex-1" onClick={submit} disabled={!valid || api.busy}>
            Xác nhận cọc
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Huỷ
          </button>
        </>
      }
    >
      <Field label="Tên khách đặt cọc" required>
        <input className="input" autoFocus value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nguyễn Văn A" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <MoneyInput label="Tiền cọc" value={deposit} onChange={setDeposit} required />
        <MoneyInput label="Giá bán ra" value={agreed} onChange={setAgreed} required />
      </div>
      {d > 0 && a > 0 && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--chip)] px-3 py-2 text-[12px]">
          Còn thanh toán khi giao xe:{" "}
          <span className="font-semibold text-[var(--warn)]">{formatIg(Math.max(0, a - d))}</span>
          <span className="ml-2 text-[var(--muted)]">· ví cộng ngay {formatIg(d)}</span>
        </div>
      )}
      <Field label="Ghi chú">
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}

// ── Bán xe ────────────────────────────────────────────────────────────────────
function SellModal({ api, vehicle, onClose }: { api: Api; vehicle: Vehicle; onClose: () => void }) {
  const [price, setPrice] = useState(vehicle.agreed_price ? String(vehicle.agreed_price) : "");
  const [customer, setCustomer] = useState(vehicle.customer_name ?? "");
  const [note, setNote] = useState("");
  const [useTime, setUseTime] = useState(false);
  const [date, setDate] = useState(todayDate());
  const [time, setTime] = useState(nowTime());

  const p = parseMoney(price) ?? 0;
  const tax = p > 0 ? saleTax(p) : 0;
  const profit = p > 0 ? p - tax - vehicle.purchase_price : 0;
  const deposit = vehicle.deposit_amount ?? 0;
  const timer = sellableIn(vehicle.imported_at);

  async function submit() {
    const res = await api.send("/api/vehicle", {
      action: "sell",
      id: vehicle.id,
      price,
      customerName: customer || undefined,
      note: note || undefined,
      at: useTime ? buildAt(date, time) : undefined,
    });
    if (res.ok) onClose();
  }

  return (
    <Modal
      title={`Bán xe — ${vehicle.name} (#${vehicle.id})`}
      icon="💰"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-primary flex-1" onClick={submit} disabled={p <= 0 || api.busy}>
            Xác nhận bán
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Huỷ
          </button>
        </>
      }
    >
      {!timer.ready && (
        <p className="rounded-xl border border-[rgba(224,176,74,0.35)] bg-[rgba(224,176,74,0.08)] px-3 py-2 text-[12px] text-[var(--warn)]">
          Xe chưa đủ 48 giờ ({timer.text}). Muốn bán sớm thì tick “thời gian thủ công” và chọn mốc sau {formatDateTime(new Date(new Date(vehicle.imported_at).getTime() + HOURS_48_MS).toISOString())}.
        </p>
      )}
      <MoneyInput label="Giá bán thực tế" value={price} onChange={setPrice} required autoFocus />
      <Field label="Tên khách mua">
        <input className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="để trống nếu giữ khách đã cọc" />
      </Field>
      {p > 0 && (
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--line)] bg-[var(--chip)] p-3 text-[12px] sm:grid-cols-4">
          <div>
            <p className="text-[var(--muted)]">Thuế {TAX_LABEL}</p>
            <p className="tnum text-[var(--bad)]">{formatIg(tax)}</p>
          </div>
          <div>
            <p className="text-[var(--muted)]">Lãi thực</p>
            <p className={`tnum ${profit >= 0 ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>{formatIg(profit)}</p>
          </div>
          <div>
            <p className="text-[var(--muted)]">Đã cọc</p>
            <p className="tnum text-[var(--warn)]">{deposit ? formatIg(deposit) : "—"}</p>
          </div>
          <div>
            <p className="text-[var(--muted)]">Ví cộng thêm</p>
            <p className="tnum text-[var(--good)]">{formatIg(p - deposit - tax)}</p>
          </div>
        </div>
      )}
      <Field label="Ghi chú">
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <DateTimePicker
        on={useTime}
        setOn={setUseTime}
        date={date}
        setDate={setDate}
        time={time}
        setTime={setTime}
        label="Điền thời gian bán thủ công"
      />
    </Modal>
  );
}

// ── Huỷ cọc ───────────────────────────────────────────────────────────────────
function CancelDepositModal({ api, vehicle, onClose }: { api: Api; vehicle: Vehicle; onClose: () => void }) {
  const [refund, setRefund] = useState("0");
  const [note, setNote] = useState("");
  const deposit = vehicle.deposit_amount ?? 0;
  const r = Math.min(parseMoney(refund) ?? 0, deposit);

  async function submit() {
    const res = await api.send("/api/vehicle", {
      action: "cancel_deposit",
      id: vehicle.id,
      refund,
      note: note || undefined,
    });
    if (res.ok) onClose();
  }

  return (
    <Modal
      title={`Huỷ cọc — ${vehicle.name} (#${vehicle.id})`}
      icon="🔴"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-primary flex-1" onClick={submit} disabled={api.busy}>
            Xác nhận huỷ cọc
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Đóng
          </button>
        </>
      }
    >
      <div className="rounded-xl border border-[var(--line)] bg-[var(--chip)] px-3 py-2 text-[12px]">
        Khách <span className="text-[var(--ink)]">{vehicle.customer_name ?? "—"}</span> đã cọc{" "}
        <span className="font-semibold text-[var(--warn)]">{formatIg(deposit)}</span>
      </div>
      <MoneyInput label="Hoàn trả khách" value={refund} onChange={setRefund} autoFocus hint="Để 0 nếu giữ toàn bộ cọc." />
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)]/40 p-3 text-[12px]">
        <div>
          <p className="text-[var(--muted)]">Hoàn khách</p>
          <p className="tnum text-[var(--bad)]">{formatIg(r)}</p>
        </div>
        <div>
          <p className="text-[var(--muted)]">Mình giữ lại</p>
          <p className="tnum text-[var(--good)]">{formatIg(Math.max(0, deposit - r))}</p>
        </div>
      </div>
      <Field label="Ghi chú">
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}

// ── Sửa xe ────────────────────────────────────────────────────────────────────
function EditModal({ api, vehicle, onClose }: { api: Api; vehicle: Vehicle; onClose: () => void }) {
  const [name, setName] = useState(vehicle.name);
  const [price, setPrice] = useState(String(vehicle.purchase_price));
  const [note, setNote] = useState(vehicle.note ?? "");

  async function submit() {
    const res = await api.send("/api/vehicle", {
      action: "edit",
      id: vehicle.id,
      name,
      price,
      note,
    });
    if (res.ok) onClose();
  }

  return (
    <Modal
      title={`Sửa xe #${vehicle.id}`}
      icon="✏️"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-primary flex-1" onClick={submit} disabled={api.busy}>
            Lưu thay đổi
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Huỷ
          </button>
        </>
      }
    >
      <Field label="Tên xe" required>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <MoneyInput label="Giá nhập" value={price} onChange={setPrice} hint="Sửa giá nhập sẽ cập nhật lại đúng số tiền đã trừ trong ví." />
      <Field label="Ghi chú">
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}

// ── Ảnh xe ────────────────────────────────────────────────────────────────────
function ImagesModal({
  api,
  vehicle,
  onClose,
  onZoom,
}: {
  api: Api;
  vehicle: Vehicle;
  onClose: () => void;
  onZoom: (src: string) => void;
}) {
  const images = api.state.images[vehicle.id] ?? [];

  return (
    <Modal
      title={`Ảnh — ${vehicle.name} (#${vehicle.id})`}
      icon="🖼"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary flex-1" onClick={onClose}>
          Xong
        </button>
      }
    >
      <PasteZone
        onUploaded={(path) => api.send("/api/vehicle", { action: "add_image", id: vehicle.id, path })}
        notify={api.notify}
      />
      {images.length === 0 ? (
        <p className="text-center text-[12px] text-[var(--muted)]">Chưa có ảnh nào cho xe này.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((img) => (
            <div key={img.id} className="thumb aspect-[4/3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.path} alt={vehicle.name} onClick={() => onZoom(img.path)} className="cursor-zoom-in" />
              <button
                type="button"
                className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white"
                onClick={() => api.send("/api/vehicle", { action: "delete_image", imageId: img.id })}
              >
                Xoá
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
