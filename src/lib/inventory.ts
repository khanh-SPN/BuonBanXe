import fs from "fs";
import path from "path";
import {
  TAX_LABEL,
  actualProfit,
  expectedSellPrice,
  formatIg,
  saleTax,
} from "./money";
import { getDb } from "./db";
import type { PeriodStat, Vehicle, VehicleImage } from "./types";
import { addLedger, deleteLedgerByRef } from "./wallet";
import {
  formatDate,
  formatDateTime,
  formatMonthLabel,
  nowIso,
  toLocalDateKey,
  toLocalMonthKey,
  todayKey,
} from "./datetime";
import { HOURS_48_MS } from "./sellable";

export interface ActionResult {
  ok: boolean;
  message: string;
  vehicleId?: number;
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function getVehicle(id: number): Vehicle | undefined {
  return getDb().prepare(`SELECT * FROM vehicles WHERE id = ?`).get(id) as Vehicle | undefined;
}

export function canSell(importedAt: string, atIso: string): boolean {
  return new Date(atIso).getTime() - new Date(importedAt).getTime() >= HOURS_48_MS;
}

export function sellableAt(importedAt: string): string {
  return new Date(new Date(importedAt).getTime() + HOURS_48_MS).toISOString();
}

function hoursUntilSellable(importedAt: string): { h: number; m: number } {
  const remainMs = Math.max(0, HOURS_48_MS - (Date.now() - new Date(importedAt).getTime()));
  const totalMinutes = Math.ceil(remainMs / (1000 * 60));
  return { h: Math.floor(totalMinutes / 60), m: totalMinutes % 60 };
}

// ── Nhập xe ───────────────────────────────────────────────────────────────────
export function importVehicle(opts: {
  name: string;
  price: number;
  at?: string;
  note?: string | null;
  images?: string[];
}): ActionResult {
  const name = normalizeName(opts.name);
  if (!name) return { ok: false, message: "Thiếu tên xe." };
  if (!opts.price || opts.price <= 0) return { ok: false, message: "Giá nhập phải lớn hơn 0." };

  const db = getDb();
  const ts = nowIso();
  const at = opts.at ?? ts;
  const expected = expectedSellPrice(opts.price);

  const result = db
    .prepare(
      `INSERT INTO vehicles (
        name, purchase_price, expected_price, status, note,
        imported_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'Còn hàng', ?, ?, ?, ?)`,
    )
    .run(name, Math.round(opts.price), expected, opts.note?.trim() || null, at, ts, ts);

  const id = Number(result.lastInsertRowid);

  addLedger({
    kind: "car_buy",
    category: "Xe",
    label: `Nhập xe ${name}`,
    igDelta: -opts.price,
    refType: "vehicle",
    refId: id,
    note: opts.note?.trim() || null,
    at,
  });

  for (const img of opts.images ?? []) attachImage(id, img);

  return {
    ok: true,
    vehicleId: id,
    message: `Đã nhập ${name} (#${id}) — ${formatIg(opts.price)}, bán được sau ${formatDateTime(sellableAt(at))}`,
  };
}

// ── Đặt cọc ───────────────────────────────────────────────────────────────────
export function depositVehicle(opts: {
  id: number;
  deposit: number;
  agreedPrice: number;
  customerName: string;
  note?: string | null;
  at?: string;
}): ActionResult {
  const vehicle = getVehicle(opts.id);
  if (!vehicle) return { ok: false, message: `Không tìm thấy xe #${opts.id}.` };
  if (vehicle.status === "Đã bán hết")
    return { ok: false, message: `Xe ${vehicle.name} đã bán hết, không thể nhận cọc.` };
  if (vehicle.status === "đã đặt cọc")
    return { ok: false, message: `Xe ${vehicle.name} đang có cọc rồi — huỷ cọc cũ trước đã.` };
  if (!opts.customerName?.trim()) return { ok: false, message: "Thiếu tên khách đặt cọc." };
  if (!opts.deposit || opts.deposit <= 0) return { ok: false, message: "Tiền cọc phải lớn hơn 0." };
  if (!opts.agreedPrice || opts.agreedPrice <= 0)
    return { ok: false, message: "Giá bán ra phải lớn hơn 0." };
  if (opts.agreedPrice < opts.deposit)
    return { ok: false, message: "Giá bán ra phải lớn hơn hoặc bằng tiền cọc." };

  const ts = nowIso();
  const at = opts.at ?? ts;
  const note = [vehicle.note, opts.note?.trim()].filter(Boolean).join(" ; ");

  getDb()
    .prepare(
      `UPDATE vehicles
       SET status = 'đã đặt cọc', deposit_amount = ?, agreed_price = ?, deposit_at = ?,
           customer_name = ?, note = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      Math.round(opts.deposit),
      Math.round(opts.agreedPrice),
      at,
      opts.customerName.trim(),
      note || null,
      ts,
      opts.id,
    );

  addLedger({
    kind: "car_deposit",
    category: "Xe",
    label: `Nhận cọc ${vehicle.name} — ${opts.customerName.trim()}`,
    igDelta: opts.deposit,
    refType: "vehicle",
    refId: opts.id,
    at,
  });

  return {
    ok: true,
    vehicleId: opts.id,
    message: `Đã nhận cọc ${formatIg(opts.deposit)} của ${opts.customerName.trim()} — còn thanh toán ${formatIg(opts.agreedPrice - opts.deposit)}`,
  };
}

// ── Huỷ cọc ───────────────────────────────────────────────────────────────────
export function cancelDeposit(opts: {
  id: number;
  refund: number;
  note?: string | null;
}): ActionResult {
  const vehicle = getVehicle(opts.id);
  if (!vehicle) return { ok: false, message: `Không tìm thấy xe #${opts.id}.` };
  if (vehicle.status !== "đã đặt cọc")
    return { ok: false, message: `Xe ${vehicle.name} không ở trạng thái đặt cọc.` };

  const originalDeposit = vehicle.deposit_amount ?? 0;
  const refund = Math.max(0, Math.min(Math.round(opts.refund), originalDeposit));
  const kept = originalDeposit - refund;
  const ts = nowIso();
  const note = [
    vehicle.note,
    `huỷ cọc: hoàn ${formatIg(refund)} / giữ ${formatIg(kept)}`,
    opts.note?.trim(),
  ]
    .filter(Boolean)
    .join(" ; ");

  getDb()
    .prepare(
      `UPDATE vehicles
       SET status = 'Còn hàng', deposit_amount = NULL, agreed_price = NULL, deposit_at = NULL,
           customer_name = NULL, note = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(note || null, ts, opts.id);

  if (refund > 0) {
    addLedger({
      kind: "car_deposit_refund",
      category: "Xe",
      label: `Hoàn cọc ${vehicle.name}${vehicle.customer_name ? ` — ${vehicle.customer_name}` : ""}`,
      igDelta: -refund,
      refType: "vehicle",
      refId: opts.id,
      at: ts,
    });
  }

  return {
    ok: true,
    vehicleId: opts.id,
    message: `Đã huỷ cọc ${vehicle.name} — hoàn ${formatIg(refund)}, giữ lại ${formatIg(kept)}`,
  };
}

// ── Bán xe ────────────────────────────────────────────────────────────────────
export function sellVehicle(opts: {
  id: number;
  price: number;
  customerName?: string | null;
  note?: string | null;
  at?: string;
}): ActionResult {
  const vehicle = getVehicle(opts.id);
  if (!vehicle) return { ok: false, message: `Không tìm thấy xe #${opts.id}.` };
  if (vehicle.status === "Đã bán hết") return { ok: false, message: `Xe ${vehicle.name} đã bán rồi.` };
  if (!opts.price || opts.price <= 0) return { ok: false, message: "Giá bán phải lớn hơn 0." };

  const ts = nowIso();
  const at = opts.at ?? ts;

  if (!canSell(vehicle.imported_at, at)) {
    const { h, m } = hoursUntilSellable(vehicle.imported_at);
    return {
      ok: false,
      message: `Chưa đủ 48 giờ — còn ${h} giờ ${m} phút nữa mới bán được ${vehicle.name}.`,
    };
  }

  const price = Math.round(opts.price);
  const tax = saleTax(price);
  const profit = actualProfit(vehicle.purchase_price, price);
  const depositTaken = vehicle.deposit_amount ?? 0;
  const collectNow = price - depositTaken;
  const note = [vehicle.note, opts.note?.trim()].filter(Boolean).join(" ; ");
  const customer = opts.customerName?.trim() || vehicle.customer_name;

  getDb()
    .prepare(
      `UPDATE vehicles
       SET status = 'Đã bán hết', actual_price = ?, agreed_price = COALESCE(agreed_price, ?),
           profit = ?, sold_at = ?, customer_name = ?, note = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(price, price, profit, at, customer || null, note || null, ts, opts.id);

  addLedger({
    kind: "car_sell",
    category: "Xe",
    label: `Bán xe ${vehicle.name}${customer ? ` — ${customer}` : ""}${depositTaken > 0 ? " (đã trừ cọc)" : ""}`,
    igDelta: collectNow,
    refType: "vehicle_sale",
    refId: opts.id,
    at,
  });
  addLedger({
    kind: "car_tax",
    category: "Xe",
    label: `Thuế bán ${TAX_LABEL} — ${vehicle.name}`,
    igDelta: -tax,
    refType: "vehicle_sale",
    refId: opts.id,
    at,
  });

  return {
    ok: true,
    vehicleId: opts.id,
    message: `Đã bán ${vehicle.name} giá ${formatIg(price)} — thuế ${formatIg(tax)}, lãi thực ${formatIg(profit)}`,
  };
}

// ── Hoàn tác bán ──────────────────────────────────────────────────────────────
export function unsellVehicle(id: number): ActionResult {
  const vehicle = getVehicle(id);
  if (!vehicle) return { ok: false, message: `Không tìm thấy xe #${id}.` };
  if (vehicle.status !== "Đã bán hết")
    return { ok: false, message: `Xe ${vehicle.name} chưa bán — không có gì để hoàn tác.` };

  // Có cọc trước đó → quay về "đã đặt cọc" và giữ nguyên cọc / giá bán ra / khách.
  // Không có cọc → giá bán ra và tên khách là do lệnh bán ghi vào nên xoá luôn.
  const hadDeposit = vehicle.deposit_amount != null && vehicle.deposit_at != null;

  getDb()
    .prepare(
      `UPDATE vehicles
       SET status = ?, actual_price = NULL, profit = NULL, sold_at = NULL,
           agreed_price = ?, customer_name = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      hadDeposit ? "đã đặt cọc" : "Còn hàng",
      hadDeposit ? vehicle.agreed_price : null,
      hadDeposit ? vehicle.customer_name : null,
      nowIso(),
      id,
    );

  deleteLedgerByRef("vehicle_sale", id);

  return {
    ok: true,
    vehicleId: id,
    message: `Đã hoàn tác bán ${vehicle.name} — tiền bán ${formatIg(vehicle.actual_price ?? 0)} đã trừ khỏi ví, xe về "${hadDeposit ? "đã đặt cọc" : "Còn hàng"}"`,
  };
}

// ── Sửa / ghi chú / xoá ───────────────────────────────────────────────────────
export function editVehicle(opts: {
  id: number;
  name?: string;
  price?: number;
  note?: string | null;
}): ActionResult {
  const vehicle = getVehicle(opts.id);
  if (!vehicle) return { ok: false, message: `Không tìm thấy xe #${opts.id}.` };

  const db = getDb();
  const ts = nowIso();
  const changes: string[] = [];

  if (opts.name != null) {
    const newName = normalizeName(opts.name);
    if (!newName) return { ok: false, message: "Tên xe không được để trống." };
    if (newName !== vehicle.name) {
      db.prepare(`UPDATE vehicles SET name = ?, updated_at = ? WHERE id = ?`).run(newName, ts, opts.id);
      changes.push(`tên → ${newName}`);
    }
  }

  if (opts.price != null) {
    if (opts.price <= 0) return { ok: false, message: "Giá nhập phải lớn hơn 0." };
    const price = Math.round(opts.price);
    if (price !== vehicle.purchase_price) {
      db.prepare(
        `UPDATE vehicles SET purchase_price = ?, expected_price = ?, updated_at = ? WHERE id = ?`,
      ).run(price, expectedSellPrice(price), ts, opts.id);

      // Sổ quỹ phải khớp giá mới: ghi đè dòng nhập xe.
      const buyRow = db
        .prepare(
          `SELECT id FROM ledger WHERE ref_type = 'vehicle' AND ref_id = ? AND kind = 'car_buy' LIMIT 1`,
        )
        .get(opts.id) as { id: number } | undefined;
      if (buyRow) {
        db.prepare(`UPDATE ledger SET ig_delta = ? WHERE id = ?`).run(-price, buyRow.id);
      }
      changes.push(`giá nhập → ${formatIg(price)}`);
    }
  }

  if (opts.note !== undefined) {
    db.prepare(`UPDATE vehicles SET note = ?, updated_at = ? WHERE id = ?`).run(
      opts.note?.trim() || null,
      ts,
      opts.id,
    );
    changes.push("ghi chú");
  }

  if (!changes.length) return { ok: true, vehicleId: opts.id, message: "Không có gì thay đổi." };
  return { ok: true, vehicleId: opts.id, message: `Đã cập nhật #${opts.id}: ${changes.join(" · ")}` };
}

export function deleteVehicle(id: number): ActionResult {
  const vehicle = getVehicle(id);
  if (!vehicle) return { ok: false, message: `Không tìm thấy xe #${id}.` };

  for (const img of listVehicleImages(id)) removeImageFile(img.path);
  getDb().prepare(`DELETE FROM vehicle_images WHERE vehicle_id = ?`).run(id);
  deleteLedgerByRef("vehicle", id);
  deleteLedgerByRef("vehicle_sale", id);
  getDb().prepare(`DELETE FROM vehicles WHERE id = ?`).run(id);

  return { ok: true, message: `Đã xoá ${vehicle.name} (#${id}) và mọi khoản liên quan trong ví.` };
}

// ── Ảnh xe ────────────────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export function attachImage(vehicleId: number, imgPath: string): VehicleImage | null {
  if (!getVehicle(vehicleId)) return null;
  const ts = nowIso();
  const result = getDb()
    .prepare(`INSERT INTO vehicle_images (vehicle_id, path, created_at) VALUES (?, ?, ?)`)
    .run(vehicleId, imgPath, ts);
  return {
    id: Number(result.lastInsertRowid),
    vehicle_id: vehicleId,
    path: imgPath,
    created_at: ts,
  };
}

export function listVehicleImages(vehicleId: number): VehicleImage[] {
  return getDb()
    .prepare(`SELECT * FROM vehicle_images WHERE vehicle_id = ? ORDER BY id ASC`)
    .all(vehicleId) as VehicleImage[];
}

export function allVehicleImages(): VehicleImage[] {
  return getDb().prepare(`SELECT * FROM vehicle_images ORDER BY id ASC`).all() as VehicleImage[];
}

function removeImageFile(imgPath: string) {
  try {
    const file = path.join(UPLOAD_DIR, path.basename(imgPath));
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    // ảnh mất file thì thôi, không chặn thao tác
  }
}

export function deleteImage(imageId: number): ActionResult {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM vehicle_images WHERE id = ?`).get(imageId) as
    | VehicleImage
    | undefined;
  if (!row) return { ok: false, message: "Không tìm thấy ảnh." };
  removeImageFile(row.path);
  db.prepare(`DELETE FROM vehicle_images WHERE id = ?`).run(imageId);
  return { ok: true, vehicleId: row.vehicle_id, message: "Đã xoá ảnh." };
}

// ── Truy vấn ──────────────────────────────────────────────────────────────────
export function getAllVehicles(): Vehicle[] {
  return getDb().prepare(`SELECT * FROM vehicles ORDER BY id DESC`).all() as Vehicle[];
}

export function getActiveVehicles(): Vehicle[] {
  return getDb()
    .prepare(
      `SELECT * FROM vehicles
       WHERE status IN ('Còn hàng', 'đã đặt cọc')
       ORDER BY CASE status WHEN 'đã đặt cọc' THEN 0 ELSE 1 END, id DESC`,
    )
    .all() as Vehicle[];
}

export function getSoldVehicles(): Vehicle[] {
  return getDb()
    .prepare(`SELECT * FROM vehicles WHERE status = 'Đã bán hết' ORDER BY sold_at DESC, id DESC`)
    .all() as Vehicle[];
}

function buildPeriodStats(
  vehicles: Vehicle[],
  keyOf: (iso: string) => string,
  labelOf: (key: string) => string,
  limit: number,
): PeriodStat[] {
  const map = new Map<string, PeriodStat>();

  function ensure(key: string): PeriodStat {
    let row = map.get(key);
    if (!row) {
      row = {
        key,
        label: labelOf(key),
        importedCount: 0,
        importCost: 0,
        soldCount: 0,
        revenue: 0,
        profit: 0,
      };
      map.set(key, row);
    }
    return row;
  }

  for (const v of vehicles) {
    const importRow = ensure(keyOf(v.imported_at));
    importRow.importedCount += 1;
    importRow.importCost += v.purchase_price;

    if (v.sold_at) {
      const soldRow = ensure(keyOf(v.sold_at));
      soldRow.soldCount += 1;
      soldRow.revenue += v.actual_price ?? 0;
      soldRow.profit += v.profit ?? 0;
    }
  }

  return Array.from(map.values())
    .sort((a, b) => (a.key < b.key ? 1 : -1))
    .slice(0, limit);
}

export function getDailyStats(limit = 30): PeriodStat[] {
  return buildPeriodStats(
    getAllVehicles(),
    toLocalDateKey,
    (key) => formatDate(`${key}T12:00:00+07:00`),
    limit,
  );
}

export function getMonthlyStats(limit = 12): PeriodStat[] {
  return buildPeriodStats(getAllVehicles(), toLocalMonthKey, formatMonthLabel, limit);
}

export function getVehicleStats() {
  const vehicles = getAllVehicles();
  const active = getActiveVehicles();
  const sold = getSoldVehicles();
  const deposited = active.filter((v) => v.status === "đã đặt cọc");
  const inStock = active.filter((v) => v.status === "Còn hàng");

  const totalPurchaseAll = vehicles.reduce((s, v) => s + v.purchase_price, 0);
  const totalSold = sold.reduce((s, v) => s + (v.actual_price ?? 0), 0);
  const totalProfit = sold.reduce((s, v) => s + (v.profit ?? 0), 0);
  const capitalInStock = active.reduce((s, v) => s + v.purchase_price, 0);
  const depositHeld = deposited.reduce((s, v) => s + (v.deposit_amount ?? 0), 0);

  const today = todayKey();
  const soldToday = sold.filter((v) => v.sold_at && toLocalDateKey(v.sold_at) === today);
  const importedToday = vehicles.filter((v) => toLocalDateKey(v.imported_at) === today);
  const profitToday = soldToday.reduce((s, v) => s + (v.profit ?? 0), 0);

  return {
    counts: {
      total: vehicles.length,
      inStock: inStock.length,
      deposited: deposited.length,
      sold: sold.length,
      active: active.length,
    },
    totals: {
      purchase: totalPurchaseAll,
      sold: totalSold,
      profit: totalProfit,
      capitalInStock,
      depositHeld,
    },
    today: {
      date: today,
      imported: importedToday.length,
      sold: soldToday.length,
      profit: profitToday,
    },
    vehicles: active,
    soldVehicles: sold,
    daily: getDailyStats(),
    monthly: getMonthlyStats(),
  };
}
