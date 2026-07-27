import {
  actualProfit,
  expectedSellPrice,
  formatMoney,
  parseMoney,
} from "./money";
import { getDb, type Vehicle, type VehicleStatus } from "./db";
import {
  formatDate,
  formatDateTime,
  formatMonthLabel,
  nowIso,
  parseViDate,
  peelDateTime,
  toLocalDateKey,
  toLocalMonthKey,
  todayKey,
} from "./datetime";

const HOURS_48_MS = 48 * 60 * 60 * 1000;
const MONEY = String.raw`[0-9][\d.,]*(?:triệu|trieu|tr|k|m)?`;

export interface ChatReply {
  reply: string;
  ok: boolean;
  refresh?: boolean;
}

export interface ActionPayload {
  action: "import" | "deposit" | "sell" | "cancel_deposit";
  // import
  name?: string;
  price?: string;
  at?: string;
  // deposit / sell
  vehicleId?: number;
  deposit?: string;
  agreedPrice?: string;
  // cancel deposit
  refund?: string;
  // shared
  customerName?: string;
  note?: string;
}

export type ParsedCommand =
  | { type: "import"; name: string; price: number; at: string }
  | {
      type: "deposit";
      name: string;
      amount: number;
      agreedPrice: number;
      at: string;
    }
  | { type: "sell"; name: string; price: number; at: string }
  | { type: "delete"; target: string }
  | { type: "delete_all"; confirm: boolean }
  | { type: "list"; filter: "active" | "deposit" | "stock" }
  | { type: "daily"; date: string }
  | { type: "summary" }
  | { type: "help" }
  | { type: "find"; name: string }
  | { type: "edit"; target: string; field: string; value: string }
  | { type: "note"; target: string; note: string }
  | { type: "near"; hours: number }
  | { type: "profit"; days: number }
  | { type: "unknown"; reason: string };

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function escapeLike(s: string) {
  return s.replace(/[%_]/g, "\\$&");
}

export function findVehiclesByName(name: string, activeOnly = false): Vehicle[] {
  const db = getDb();
  const key = normalizeName(name).toLowerCase();
  const rows = db
    .prepare(
      `SELECT * FROM vehicles
       WHERE lower(name) = ? OR lower(name) LIKE ? ESCAPE '\\'
       ORDER BY id DESC`,
    )
    .all(key, `%${escapeLike(key)}%`) as Vehicle[];

  if (!activeOnly) return rows;
  return rows.filter((v) => v.status !== "Đã bán hết");
}

function pickVehicle(
  name: string,
  opts: { preferActive?: boolean; preferDeposit?: boolean } = {},
): { vehicle?: Vehicle; error?: string } {
  if (/^#?\d+$/.test(name.trim())) {
    const id = Number(name.replace("#", ""));
    const row = getDb()
      .prepare(`SELECT * FROM vehicles WHERE id = ?`)
      .get(id) as Vehicle | undefined;
    if (!row) return { error: `Không có xe #${id}.` };
    return { vehicle: row };
  }

  const all = findVehiclesByName(name);
  if (all.length === 0) {
    return { error: `Không tìm thấy xe "${name}". Gõ "kho" để xem danh sách.` };
  }

  let candidates = all;
  if (opts.preferActive) {
    const active = all.filter((v) => v.status !== "Đã bán hết");
    if (active.length) candidates = active;
  }
  if (opts.preferDeposit) {
    const deposited = candidates.filter((v) => v.status === "đã đặt cọc");
    if (deposited.length) candidates = deposited;
  }

  if (candidates.length > 1) {
    const exact = candidates.filter(
      (v) => v.name.toLowerCase() === normalizeName(name).toLowerCase(),
    );
    if (exact.length === 1) return { vehicle: exact[0] };
    if (exact.length > 1) candidates = exact;
  }

  if (candidates.length > 1) {
    const list = candidates
      .slice(0, 5)
      .map(
        (v) =>
          `#${v.id} ${v.name} — ${v.status} — nhập ${formatMoney(v.purchase_price)}`,
      )
      .join("\n");
    return {
      error: `Có nhiều xe khớp "${name}". Dùng #id hoặc tên rõ hơn:\n${list}`,
    };
  }

  return { vehicle: candidates[0] };
}

function hoursUntilSellable(importedAt: string): { h: number; m: number } {
  const remainMs = Math.max(
    0,
    HOURS_48_MS - (Date.now() - new Date(importedAt).getTime()),
  );
  const totalMinutes = Math.ceil(remainMs / (1000 * 60));
  return { h: Math.floor(totalMinutes / 60), m: totalMinutes % 60 };
}

export function canSell(importedAt: string, atIso: string): boolean {
  return new Date(atIso).getTime() - new Date(importedAt).getTime() >= HOURS_48_MS;
}

function remainingPay(v: Vehicle): number | null {
  if (v.agreed_price == null || v.deposit_amount == null) return null;
  return Math.max(0, v.agreed_price - v.deposit_amount);
}

export function parseCommand(input: string): ParsedCommand {
  const peeled = peelDateTime(input.trim());
  const text = peeled.text.trim();
  const at = peeled.at ?? nowIso();
  if (!text) return { type: "unknown", reason: "Bạn chưa nhập lệnh." };

  const lower = text.toLowerCase();

  if (
    /^(help|trợ giúp|huong dan|hướng dẫn|\?|menu)$/i.test(text)
  ) {
    return { type: "help" };
  }

  // xóa hết / xóa tất cả
  if (/^(?:xóa|xoa)\s+(?:hết|het|tất cả|tat ca)(?:\s+xác nhận|\s+xac nhan)?$/i.test(text)) {
    return {
      type: "delete_all",
      confirm: /xác nhận|xac nhan/i.test(text),
    };
  }

  // xóa #1 | xóa GTR
  const deleteMatch = text.match(/^(?:xóa|xoa|\/xoa)\s+(.+)$/i);
  if (deleteMatch) {
    return { type: "delete", target: normalizeName(deleteMatch[1]) };
  }

  // kho — chỉ xe chưa bán / đã cọc
  if (
    /^(kho|danh sách|danhsach|list|xem kho)$/i.test(text)
  ) {
    return { type: "list", filter: "active" };
  }
  if (/^(còn hàng|con hang)$/i.test(text)) {
    return { type: "list", filter: "stock" };
  }
  if (/^(đã cọc|da coc|đặt cọc|dat coc)$/i.test(text)) {
    return { type: "list", filter: "deposit" };
  }

  // tổng hợp ngày 15/7 | tong hop 15/7 | tong hop 15/7/2026 | ngày 15-7
  const dailyFull = text.match(
    /^(?:tổng hợp|tong hop|ngày|ngay|daily)\s+(?:ngày|ngay)?\s*(\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?)$/i,
  );
  if (dailyFull) {
    const parsed = parseViDate(dailyFull[1]);
    if (!parsed) {
      return { type: "unknown", reason: "Ngày không hợp lệ. Ví dụ: tong hop 15/7, tong hop 15-7-2026, ngày 15.7" };
    }
    return { type: "daily", date: parsed };
  }

  if (
    /^(hôm nay|hom nay|today|lãi hôm nay|lai hom nay|tổng hợp|tong hop)$/i.test(
      text,
    )
  ) {
    return { type: "daily", date: todayKey() };
  }

  if (
    /^(tổng|tong|summary|báo cáo|bao cao|thống kê|thong ke)$/i.test(text)
  ) {
    return { type: "summary" };
  }

  // nhập GTR 10m
  const importMatch = text.match(
    new RegExp(String.raw`^(?:nhập|nhap|\/nhap|\/nhập)\s+(.+?)\s+(${MONEY})$`, "i"),
  );
  if (importMatch) {
    const price = parseMoney(importMatch[2]);
    if (price == null || price <= 0) {
      return {
        type: "unknown",
        reason: `Không đọc được giá "${importMatch[2]}". Ví dụ: 10m, 100k, 7.5tr`,
      };
    }
    return {
      type: "import",
      name: normalizeName(importMatch[1]),
      price,
      at,
    };
  }

  // /coc gtr 100k 6.5m  |  cọc gtr 100k 6,5tr
  const depositMatch = text.match(
    new RegExp(
      String.raw`^(?:\/coc|\/cọc|coc|cọc|đặt cọc|dat coc)\s+(.+?)\s+(${MONEY})\s+(${MONEY})$`,
      "i",
    ),
  );
  if (depositMatch) {
    const amount = parseMoney(depositMatch[2]);
    const agreedPrice = parseMoney(depositMatch[3]);
    if (amount == null || amount <= 0) {
      return {
        type: "unknown",
        reason: `Không đọc được tiền cọc "${depositMatch[2]}". Ví dụ: 100k`,
      };
    }
    if (agreedPrice == null || agreedPrice <= 0) {
      return {
        type: "unknown",
        reason: `Không đọc được giá bán ra "${depositMatch[3]}". Ví dụ: 6.5m hoặc 6,5tr`,
      };
    }
    if (agreedPrice < amount) {
      return {
        type: "unknown",
        reason: "Giá bán ra phải lớn hơn hoặc bằng tiền cọc.",
      };
    }
    return {
      type: "deposit",
      name: normalizeName(depositMatch[1]),
      amount,
      agreedPrice,
      at,
    };
  }

  // cọc thiếu giá bán
  if (/^(?:\/coc|\/cọc|coc|cọc|đặt cọc|dat coc)\s+/i.test(text)) {
    return {
      type: "unknown",
      reason:
        "Cọc cần 2 số tiền: `/coc [xe] [tiền cọc] [giá bán ra]`\nVí dụ: `/coc GTR 100k 6.5m` hoặc `cọc GTR 100k 6,5tr`",
    };
  }

  // bán gtr 13.5m (bắt buộc có giá bán thực tế)
  const sellMatch = text.match(
    new RegExp(
      String.raw`^(?:bán|ban|\/ban|\/bán)\s+(.+?)\s+(${MONEY})$`,
      "i",
    ),
  );
  if (sellMatch) {
    const price = parseMoney(sellMatch[2]);
    if (price == null || price <= 0) {
      return {
        type: "unknown",
        reason: `Không đọc được giá bán "${sellMatch[2]}". Bán phải có giá thực tế.`,
      };
    }
    return {
      type: "sell",
      name: normalizeName(sellMatch[1]),
      price,
      at,
    };
  }

  // bán gtr (không có giá) -> báo lỗi
  if (/^(?:bán|ban|\/ban|\/bán)\s+/i.test(text)) {
    return {
      type: "unknown",
      reason: "Bán xe phải có giá bán thực tế. Ví dụ: `bán GTR 13.5m`",
    };
  }

  const findMatch = text.match(/^(?:tìm|tim|xem|chi tiết|chi tiet)\s+(.+)$/i);
  if (findMatch) {
    return { type: "find", name: normalizeName(findMatch[1]) };
  }

  return {
    type: "unknown",
    reason:
      "Không hiểu lệnh. Gõ **help** để xem hướng dẫn.\n• nhập GTR 10m\n• /coc GTR 100k 6.5m\n• bán GTR\n• tong hop ngày 15/7\n• xóa #1",
  };
}

export function handleCommand(input: string): ChatReply {
  const cmd = parseCommand(input);

  switch (cmd.type) {
    case "help":
      return { ok: true, reply: helpText() };
    case "import":
      return doImport(cmd.name, cmd.price, cmd.at);
    case "deposit": {
      const { vehicle: dv, error: de } = pickVehicle(cmd.name, { preferActive: true });
      if (!dv) return { ok: false, reply: de! };
      return doDepositOnVehicle(dv, cmd.amount, cmd.agreedPrice, cmd.at);
    }
    case "sell":
      return doSell(cmd.name, cmd.price, cmd.at);
    case "delete":
      return doDelete(cmd.target);
    case "delete_all":
      return doDeleteAll(cmd.confirm);
    case "list":
      return { ok: true, reply: listVehicles(cmd.filter) };
    case "daily":
      return { ok: true, reply: dailyReport(cmd.date) };
    case "summary":
      return { ok: true, reply: overallSummary() };
    case "find":
      return { ok: true, reply: vehicleDetail(cmd.name) };
    case "edit":
      return { ok: false, reply: "Tính năng sửa đang phát triển." };
    case "note":
      return { ok: false, reply: "Tính năng ghi chú đang phát triển." };
    case "near":
      return { ok: false, reply: "Tính năng sắp bán đang phát triển." };
    case "profit":
      return { ok: false, reply: "Tính năng lãi theo ngày đang phát triển." };
    case "unknown":
      return { ok: false, reply: cmd.reason };
    default:
      return { ok: false, reply: "Lệnh không được hỗ trợ." };
  }
}

function helpText() {
  return [
    "**Lệnh chính**",
    "• `nhập [xe] [giá]` — nhập kho (+35% dự kiến). Có thể thêm giờ: `nhập GTR 10m 18h31 15/7`",
    "• `/coc [xe] [cọc] [giá bán]` — ví dụ `/coc GTR 100k 6.5m` → còn thanh toán = giá bán − cọc",
    "• `bán [xe] [giá]` — bán sau 48h, BẮT BUỘC có giá thực tế: `bán GTR 13.5m`",
    "• `xóa #1` / `xóa GTR` — xóa 1 xe · `xóa hết xác nhận` — xóa cả kho",
    "",
    "**Xem**",
    "• `kho` — chỉ xe còn hàng + đã cọc (dạng bảng bên phải)",
    "• `tong hop 15/7` hoặc `ngày 15-7-2026` — chỉ ngày đó (gồm xe đã bán)",
    "• `tổng` — tổng hợp toàn bộ + xe đã bán",
    "• `tìm GTR` — xem chi tiết xe",
    "",
    "**Giá** `10m`/`10tr`/`6,5tr`/`100k`",
  ].join("\n");
}

function doImport(name: string, price: number, at: string, note?: string): ChatReply {
  const db = getDb();
  const ts = nowIso();
  const expected = expectedSellPrice(price);

  const result = db
    .prepare(
      `INSERT INTO vehicles (
        name, purchase_price, expected_price, status, note,
        imported_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'Còn hàng', ?, ?, ?, ?)`,
    )
    .run(name, price, expected, note || null, at, ts, ts);

  const sellableAt = new Date(
    new Date(at).getTime() + HOURS_48_MS,
  ).toISOString();

  const replyLines = [
    `✅ Đã nhập **${name}** (#${result.lastInsertRowid})`,
    `• Giá nhập: ${formatMoney(price)}`,
    `• Giá bán dự kiến (+35%): ${formatMoney(expected)}`,
    `• Ngày nhập: ${formatDateTime(at)}`,
    `• Bán được sau: ${formatDateTime(sellableAt)} (48 giờ)`,
  ];
  if (note) replyLines.push(`• Ghi chú: ${note}`);
  return { ok: true, refresh: true, reply: replyLines.join("\n") };
}

function doDepositOnVehicle(
  vehicle: Vehicle,
  amount: number,
  agreedPrice: number,
  at: string,
  userNote?: string,
  customerName?: string,
): ChatReply {
  if (vehicle.status === "Đã bán hết") {
    return { ok: false, reply: `Xe **${vehicle.name}** đã bán hết, không thể nhận cọc.` };
  }

  const db = getDb();
  const ts = nowIso();
  const remain = agreedPrice - amount;
  const noteParts = [vehicle.note, userNote].filter(Boolean).join(" ; ");
  const sellableAt = new Date(
    new Date(vehicle.imported_at).getTime() + HOURS_48_MS,
  ).toISOString();

  db.prepare(
    `UPDATE vehicles
     SET status = 'đã đặt cọc',
         deposit_amount = ?,
         agreed_price = ?,
         deposit_at = ?,
         customer_name = ?,
         note = ?,
         updated_at = ?
     WHERE id = ?`,
  ).run(amount, agreedPrice, at, customerName?.trim() || null, noteParts || null, ts, vehicle.id);

  return {
    ok: true,
    refresh: true,
    reply: [
      `🟡 Đã nhận cọc **${vehicle.name}** (#${vehicle.id})`,
      ...(customerName?.trim() ? [`• Khách cọc: ${customerName.trim()}`] : []),
      `• Tiền cọc: ${formatMoney(amount)}`,
      `• Giá bán ra: ${formatMoney(agreedPrice)}`,
      `• Còn thanh toán: ${formatMoney(remain)}`,
      `• Ngày cọc: ${formatDateTime(at)}`,
      `• Ngày bán được: ${formatDateTime(sellableAt)}`,
    ].join("\n"),
  };
}

function doSellOnVehicle(
  vehicle: Vehicle,
  price: number,
  at: string,
  userNote?: string,
  customerName?: string,
): ChatReply {
  if (vehicle.status === "Đã bán hết") {
    return { ok: false, reply: `Xe **${vehicle.name}** đã bán rồi.` };
  }
  if (price <= 0) return { ok: false, reply: "Giá bán phải lớn hơn 0." };

  if (!canSell(vehicle.imported_at, at)) {
    const { h, m } = hoursUntilSellable(vehicle.imported_at);
    return {
      ok: false,
      reply: [
        `⏳ Chưa bán được **${vehicle.name}**.`,
        `Xe nhập ${formatDateTime(vehicle.imported_at)}.`,
        `Còn khoảng **${h} giờ ${m} phút** nữa mới đủ 48 giờ.`,
      ].join("\n"),
    };
  }

  const profit = actualProfit(vehicle.purchase_price, price);
  const db = getDb();
  const ts = nowIso();
  const tax = Math.round(price * 0.05);
  const paidMore = vehicle.deposit_amount != null ? Math.max(0, price - vehicle.deposit_amount) : null;
  const newNote = [vehicle.note, userNote].filter(Boolean).join(" ; ");
  const finalCustomer = customerName?.trim() || vehicle.customer_name;

  db.prepare(
    `UPDATE vehicles
     SET status = 'Đã bán hết',
         actual_price = ?,
         agreed_price = COALESCE(agreed_price, ?),
         profit = ?,
         sold_at = ?,
         customer_name = ?,
         note = ?,
         updated_at = ?
     WHERE id = ?`,
  ).run(price, price, profit, at, finalCustomer || null, newNote || null, ts, vehicle.id);

  const lines = [`🟢 Đã bán **${vehicle.name}** (#${vehicle.id})`];
  if (finalCustomer) lines.push(`• Khách mua: ${finalCustomer}`);
  lines.push(`• Giá nhập: ${formatMoney(vehicle.purchase_price)}`);
  lines.push(`• Giá bán: ${formatMoney(price)}`);
  if (vehicle.deposit_amount != null) {
    lines.push(`• Đã cọc: ${formatMoney(vehicle.deposit_amount)}`);
    lines.push(`• Thu thêm khi bán: ${formatMoney(paidMore ?? 0)}`);
  }
  lines.push(`• Thuế 5%: ${formatMoney(tax)}`);
  lines.push(`• Lãi thực: ${formatMoney(profit)}`);
  lines.push(`• Ngày bán: ${formatDateTime(at)}`);
  if (userNote) lines.push(`• Ghi chú: ${userNote}`);
  return { ok: true, refresh: true, reply: lines.join("\n") };
}

function doSell(name: string, price: number, at: string): ChatReply {
  const { vehicle, error } = pickVehicle(name, { preferActive: true, preferDeposit: true });
  if (!vehicle) return { ok: false, reply: error! };
  return doSellOnVehicle(vehicle, price, at);
}

export function handleAction(body: ActionPayload): ChatReply {
  if (!body?.action) return { ok: false, reply: "Thiếu action." };

  if (body.action === "import") {
    const price = parseMoney(body.price ?? "");
    if (!body.name?.trim()) return { ok: false, reply: "Thiếu tên xe." };
    if (!price || price <= 0) return { ok: false, reply: `Giá không hợp lệ: "${body.price}". Ví dụ: 10m, 7.5tr, 150k` };
    const at = body.at ?? nowIso();
    return doImport(body.name.trim(), price, at, body.note?.trim() || undefined);
  }

  if (body.action === "deposit") {
    const id = Number(body.vehicleId);
    if (!id) return { ok: false, reply: "Thiếu xe." };
    const vehicle = getDb().prepare(`SELECT * FROM vehicles WHERE id = ?`).get(id) as Vehicle | undefined;
    if (!vehicle) return { ok: false, reply: `Không tìm thấy xe #${id}.` };
    if (!body.customerName?.trim()) return { ok: false, reply: "Thiếu tên khách đặt cọc." };
    const amount = parseMoney(body.deposit ?? "");
    const agreedPrice = parseMoney(body.agreedPrice ?? "");
    if (!amount || amount <= 0) return { ok: false, reply: `Tiền cọc không hợp lệ: "${body.deposit}"` };
    if (!agreedPrice || agreedPrice <= 0) return { ok: false, reply: `Giá bán ra không hợp lệ: "${body.agreedPrice}"` };
    if (agreedPrice < amount) return { ok: false, reply: "Giá bán ra phải lớn hơn hoặc bằng tiền cọc." };
    return doDepositOnVehicle(vehicle, amount, agreedPrice, nowIso(), body.note?.trim() || undefined, body.customerName);
  }

  if (body.action === "sell") {
    const id = Number(body.vehicleId);
    if (!id) return { ok: false, reply: "Thiếu xe." };
    const vehicle = getDb().prepare(`SELECT * FROM vehicles WHERE id = ?`).get(id) as Vehicle | undefined;
    if (!vehicle) return { ok: false, reply: `Không tìm thấy xe #${id}.` };
    const price = parseMoney(body.price ?? "");
    if (!price || price <= 0) return { ok: false, reply: `Giá bán không hợp lệ: "${body.price}"` };
    return doSellOnVehicle(vehicle, price, body.at ?? nowIso(), body.note?.trim() || undefined, body.customerName);
  }

  if (body.action === "cancel_deposit") {
    const id = Number(body.vehicleId);
    if (!id) return { ok: false, reply: "Thiếu xe." };
    const vehicle = getDb().prepare(`SELECT * FROM vehicles WHERE id = ?`).get(id) as Vehicle | undefined;
    if (!vehicle) return { ok: false, reply: `Không tìm thấy xe #${id}.` };
    if (vehicle.status !== "đã đặt cọc") return { ok: false, reply: `Xe **${vehicle.name}** không ở trạng thái đặt cọc.` };
    const refund = parseMoney(body.refund ?? "") ?? 0;
    return doRefundDeposit(vehicle, refund, body.note?.trim() || undefined);
  }

  return { ok: false, reply: "Action không hợp lệ." };
}

function doRefundDeposit(vehicle: Vehicle, refund: number, userNote?: string): ChatReply {
  const originalDeposit = vehicle.deposit_amount ?? 0;
  const kept = Math.max(0, originalDeposit - refund);
  const newNote = [
    vehicle.note,
    `hủy cọc: hoàn ${formatMoney(refund)} / giữ ${formatMoney(kept)}`,
    userNote,
  ].filter(Boolean).join(" ; ");

  const db = getDb();
  const ts = nowIso();
  db.prepare(
    `UPDATE vehicles
     SET status = 'Còn hàng',
         deposit_amount = NULL,
         agreed_price = NULL,
         deposit_at = NULL,
         customer_name = NULL,
         note = ?,
         updated_at = ?
     WHERE id = ?`,
  ).run(newNote || null, ts, vehicle.id);

  const lines = [
    `🔴 Đã hủy cọc **${vehicle.name}** (#${vehicle.id})`,
    `• Tiền cọc ban đầu: ${formatMoney(originalDeposit)}`,
    `• Hoàn trả khách: ${formatMoney(refund)}`,
    `• Mình giữ lại: ${formatMoney(kept)}`,
    `• Trạng thái xe: Còn hàng (quay lại kho)`,
  ];
  if (userNote) lines.push(`• Ghi chú: ${userNote}`);
  return { ok: true, refresh: true, reply: lines.join("\n") };
}

function doDelete(target: string): ChatReply {
  const { vehicle, error } = pickVehicle(target);
  if (!vehicle) return { ok: false, reply: error! };

  getDb().prepare(`DELETE FROM vehicles WHERE id = ?`).run(vehicle.id);
  return {
    ok: true,
    refresh: true,
    reply: `🗑️ Đã xóa **${vehicle.name}** (#${vehicle.id}).`,
  };
}

function doDeleteAll(confirm: boolean): ChatReply {
  if (!confirm) {
    return {
      ok: false,
      reply:
        "Xóa toàn bộ kho? Gõ đúng: `xóa hết xác nhận` (không hoàn tác được).",
    };
  }
  const result = getDb().prepare(`DELETE FROM vehicles`).run();
  return {
    ok: true,
    refresh: true,
    reply: `🗑️ Đã xóa hết kho (${result.changes} xe).`,
  };
}

function listVehicles(filter: "active" | "deposit" | "stock"): string {
  const rows = getActiveVehicles().filter((v) => {
    if (filter === "deposit") return v.status === "đã đặt cọc";
    if (filter === "stock") return v.status === "Còn hàng";
    return true;
  });

  if (!rows.length) return "Kho trống — không có xe chưa bán.";

  const lines = rows.map((v) => {
    const remain = remainingPay(v);
    const bits = [
      `#${v.id} **${v.name}**`,
      `nhập ${formatMoney(v.purchase_price)}`,
      v.status,
    ];
    if (v.deposit_amount != null) bits.push(`cọc ${formatMoney(v.deposit_amount)}`);
    if (v.agreed_price != null) bits.push(`bán ra ${formatMoney(v.agreed_price)}`);
    if (remain != null) bits.push(`còn TT ${formatMoney(remain)}`);
    if (v.customer_name) bits.push(`khách ${v.customer_name}`);
    return bits.join(" · ");
  });

  return [`**Kho đang giữ** (${rows.length} xe)`, ...lines].join("\n");
}

function vehicleDetail(name: string): string {
  const { vehicle, error } = pickVehicle(name);
  if (!vehicle) return error!;

  const sellableAt = new Date(
    new Date(vehicle.imported_at).getTime() + HOURS_48_MS,
  ).toISOString();
  const remain = remainingPay(vehicle);

  return [
    `**${vehicle.name}** (#${vehicle.id}) — ${vehicle.status}`,
    `• Khách: ${vehicle.customer_name || "—"}`,
    `• Giá nhập: ${formatMoney(vehicle.purchase_price)}`,
    `• Giá dự kiến (+35%): ${formatMoney(vehicle.expected_price)}`,
    `• Giá bán ra: ${vehicle.agreed_price != null ? formatMoney(vehicle.agreed_price) : "—"}`,
    `• Giá bán thực tế: ${vehicle.actual_price != null ? formatMoney(vehicle.actual_price) : "—"}`,
    `• Tiền cọc: ${vehicle.deposit_amount != null ? formatMoney(vehicle.deposit_amount) : "—"}`,
    `• Còn thanh toán: ${remain != null ? formatMoney(remain) : "—"}`,
    `• Lãi thực: ${vehicle.profit != null ? formatMoney(vehicle.profit) : "—"}`,
    `• Ghi chú: ${vehicle.note || "—"}`,
    `• Ngày nhập: ${formatDateTime(vehicle.imported_at)}`,
    `• Ngày cọc: ${formatDateTime(vehicle.deposit_at)}`,
    `• Ngày bán được: ${formatDateTime(sellableAt)}`,
    `• Ngày bán: ${formatDateTime(vehicle.sold_at)}`,
  ].join("\n");
}

export function getAllVehicles(): Vehicle[] {
  return getDb()
    .prepare(`SELECT * FROM vehicles ORDER BY id DESC`)
    .all() as Vehicle[];
}

export function getActiveVehicles(): Vehicle[] {
  return getDb()
    .prepare(
      `SELECT * FROM vehicles
       WHERE status IN ('Còn hàng', 'đã đặt cọc')
       ORDER BY
         CASE status WHEN 'đã đặt cọc' THEN 0 ELSE 1 END,
         id DESC`,
    )
    .all() as Vehicle[];
}

export function getSoldVehicles(): Vehicle[] {
  return getDb()
    .prepare(
      `SELECT * FROM vehicles WHERE status = 'Đã bán hết' ORDER BY sold_at DESC, id DESC`,
    )
    .all() as Vehicle[];
}

export interface PeriodStat {
  key: string;
  label: string;
  importedCount: number;
  importCost: number;
  soldCount: number;
  revenue: number;
  profit: number;
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
      row = { key, label: labelOf(key), importedCount: 0, importCost: 0, soldCount: 0, revenue: 0, profit: 0 };
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

export function getStats() {
  const vehicles = getAllVehicles();
  const active = getActiveVehicles();
  const sold = getSoldVehicles();
  const deposited = active.filter((v) => v.status === "đã đặt cọc");
  const inStock = active.filter((v) => v.status === "Còn hàng");

  const totalPurchaseAll = vehicles.reduce((s, v) => s + v.purchase_price, 0);
  const totalSold = sold.reduce((s, v) => s + (v.actual_price ?? 0), 0);
  const totalProfit = sold.reduce((s, v) => s + (v.profit ?? 0), 0);
  const capitalInStock = active.reduce((s, v) => s + v.purchase_price, 0);

  const today = todayKey();
  const soldToday = sold.filter(
    (v) => v.sold_at && toLocalDateKey(v.sold_at) === today,
  );
  const importedToday = vehicles.filter(
    (v) => toLocalDateKey(v.imported_at) === today,
  );
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

function dailyReport(dateKey: string): string {
  const vehicles = getAllVehicles();
  const sold = vehicles.filter(
    (v) => v.sold_at && toLocalDateKey(v.sold_at) === dateKey,
  );
  const imported = vehicles.filter(
    (v) => toLocalDateKey(v.imported_at) === dateKey,
  );
  const deposited = vehicles.filter(
    (v) => v.deposit_at && toLocalDateKey(v.deposit_at) === dateKey,
  );

  const profit = sold.reduce((s, v) => s + (v.profit ?? 0), 0);
  const revenue = sold.reduce((s, v) => s + (v.actual_price ?? 0), 0);
  const importCost = imported.reduce((s, v) => s + v.purchase_price, 0);
  const displayDate = formatDate(`${dateKey}T12:00:00+07:00`);

  const soldLines = sold.length
    ? sold
        .map(
          (v) =>
            `  • #${v.id} ${v.name}: bán ${formatMoney(v.actual_price!)} → lãi ${formatMoney(v.profit!)}`,
        )
        .join("\n")
    : "  (không có)";

  const importLines = imported.length
    ? imported
        .map(
          (v) =>
            `  • #${v.id} ${v.name}: ${formatMoney(v.purchase_price)} · ${formatDateTime(v.imported_at)}`,
        )
        .join("\n")
    : "  (không có)";

  const depositLines = deposited.length
    ? deposited
        .map((v) => {
          const remain = remainingPay(v);
          return `  • #${v.id} ${v.name}: cọc ${formatMoney(v.deposit_amount ?? 0)} / bán ${formatMoney(v.agreed_price ?? 0)}${remain != null ? ` · còn TT ${formatMoney(remain)}` : ""} · ${formatDateTime(v.deposit_at)}`;
        })
        .join("\n")
    : "  (không có)";

  return [
    `📅 **Tổng hợp ngày ${displayDate}**`,
    "",
    `**Xe bán (${sold.length})** — DT ${formatMoney(revenue)} — lãi ${formatMoney(profit)}`,
    soldLines,
    "",
    `**Xe nhập (${imported.length})** — vốn ${formatMoney(importCost)}`,
    importLines,
    "",
    `**Nhận cọc (${deposited.length})**`,
    depositLines,
  ].join("\n");
}

function overallSummary(): string {
  const s = getStats();
  const soldLines = s.soldVehicles.length
    ? s.soldVehicles
        .slice(0, 30)
        .map(
          (v) =>
            `  • #${v.id} ${v.name}: ${formatMoney(v.actual_price ?? 0)} · lãi ${formatMoney(v.profit ?? 0)} · ${formatDateTime(v.sold_at)}`,
        )
        .join("\n")
    : "  (chưa bán xe nào)";

  return [
    "**Tổng hợp toàn bộ**",
    `• Đang kho: ${s.counts.active} (còn ${s.counts.inStock} · cọc ${s.counts.deposited})`,
    `• Đã bán: ${s.counts.sold}`,
    `• Tổng tiền nhập: ${formatMoney(s.totals.purchase)}`,
    `• Tổng tiền bán: ${formatMoney(s.totals.sold)}`,
    `• Tổng lãi thực: ${formatMoney(s.totals.profit)}`,
    `• Vốn đang kho: ${formatMoney(s.totals.capitalInStock)}`,
    "",
    `Hôm nay: nhập ${s.today.imported} · bán ${s.today.sold} · lãi ${formatMoney(s.today.profit)}`,
    "",
    "**Xe đã bán**",
    soldLines,
  ].join("\n");
}

export function appendChatLog(role: "user" | "bot", content: string) {
  getDb()
    .prepare(
      `INSERT INTO chat_logs (role, content, created_at) VALUES (?, ?, ?)`,
    )
    .run(role, content, nowIso());
}

export function getRecentChat(limit = 40) {
  return getDb()
    .prepare(
      `SELECT role, content, created_at FROM chat_logs ORDER BY id DESC LIMIT ?`,
    )
    .all(limit)
    .reverse() as { role: string; content: string; created_at: string }[];
}
