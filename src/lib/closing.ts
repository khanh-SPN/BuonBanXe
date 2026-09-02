/**
 * Chốt tháng — tự tổng hợp, không nhập tay số nào.
 *
 * Ý tưởng: "tổng lãi 200 triệu" là con số cộng dồn vô tận, không neo vào đâu.
 * Cái đo được tại một thời điểm là **tài sản ròng**:
 *
 *     Vốn = Ví IG + Vốn kho (giá nhập xe tồn) + Nợ ròng − Cọc đang giữ
 *
 * Mỗi tháng là một phương trình đóng:
 *
 *     Vốn cuối = Vốn đầu + Nạp − Rút + Lãi xe + Thu/chi khác + Điều chỉnh
 *
 * và **Vốn cuối tháng N chính là Vốn đầu tháng N+1** — nên chỉ cần chốt một
 * lần, tháng sau tự có vốn gốc để tính lãi trên đó.
 *
 * Mua / bán IG bằng tiền thật KHÔNG phải lãi — đó là nạp / rút vốn. Tách hai
 * thứ này ra mới hết cảnh "cộng mãi không thấy".
 */

import { getDb } from "./db";
import { formatMonthLabel, toLocalMonthKey, todayKey } from "./datetime";
import type { MonthClosing, MonthSnapshot } from "./types";
import { getOpening } from "./wallet";

const VN_TZ = "+07:00";

/** Mốc 00:00 giờ VN ngày 1 của tháng, quy về ISO UTC để so chuỗi với cột `at`. */
function monthStart(key: string): string {
  return new Date(`${key}-01T00:00:00${VN_TZ}`).toISOString();
}

function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Danh sách tháng có dữ liệu, từ tháng cũ nhất tới tháng hiện tại. */
function monthKeys(): string[] {
  const db = getDb();
  const first = db
    .prepare(
      `SELECT MIN(t) AS t FROM (
         SELECT MIN(imported_at) AS t FROM vehicles
         UNION ALL SELECT MIN(at) FROM ledger
         UNION ALL SELECT MIN(at) FROM ig_trades
       ) WHERE t IS NOT NULL`,
    )
    .get() as { t: string | null };
  if (!first?.t) return [];

  const last = todayKey().slice(0, 7);
  const keys: string[] = [];
  for (let k = toLocalMonthKey(first.t); k <= last; k = nextMonthKey(k)) {
    keys.push(k);
    if (keys.length > 240) break; // chặn vòng lặp vô hạn nếu dữ liệu ngày giờ hỏng
  }
  return keys;
}

/** Ảnh chụp tài sản ròng ngay trước mốc `at`. */
function snapshotAt(at: string): MonthSnapshot {
  const db = getDb();

  const moved = db
    .prepare(`SELECT COALESCE(SUM(ig_delta), 0) AS s FROM ledger WHERE at < ?`)
    .get(at) as { s: number };
  const walletIg = getOpening().ig + moved.s;

  // Xe đã nhập trước mốc và tới mốc đó vẫn chưa bán → vốn còn nằm trong kho.
  const stock = db
    .prepare(
      `SELECT COALESCE(SUM(purchase_price), 0) AS s
       FROM vehicles
       WHERE imported_at < ? AND (sold_at IS NULL OR sold_at >= ?)`,
    )
    .get(at, at) as { s: number };

  // Cho vay làm tiền rời ví nhưng vẫn là tài sản; đi vay thì ngược lại.
  const debt = db
    .prepare(
      `SELECT COALESCE(SUM(-ig_delta), 0) AS s
       FROM ledger
       WHERE at < ? AND kind IN ('loan_out', 'loan_collect', 'borrow_in', 'borrow_repay')`,
    )
    .get(at) as { s: number };

  // Cọc của xe chưa bán là tiền của khách đang nằm trong ví — khoản phải trả,
  // không phải tài sản. Bán xong thì cọc tan vào giá bán nên hết nợ.
  const deposit = db
    .prepare(
      `SELECT COALESCE(SUM(l.ig_delta), 0) AS s
       FROM ledger l
       JOIN vehicles v ON v.id = l.ref_id
       WHERE l.kind IN ('car_deposit', 'car_deposit_refund')
         AND l.at < ?
         AND (v.sold_at IS NULL OR v.sold_at >= ?)`,
    )
    .get(at, at) as { s: number };

  const netWorth = walletIg + stock.s + debt.s - deposit.s;
  return {
    at,
    walletIg,
    capitalInStock: stock.s,
    debtNet: debt.s,
    depositHeld: deposit.s,
    netWorth,
  };
}

/** Tổng một nhóm bút toán trong khoảng [from, to). */
function sumKinds(from: string, to: string, kinds: string[]): number {
  const marks = kinds.map(() => "?").join(",");
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(ig_delta), 0) AS s
       FROM ledger WHERE at >= ? AND at < ? AND kind IN (${marks})`,
    )
    .get(from, to, ...kinds) as { s: number };
  return row.s;
}

/**
 * Bảng chốt của mọi tháng có dữ liệu. Tất cả đều suy ra từ `vehicles` và
 * `ledger` — thêm một bút toán cũ vào là bảng tự tính lại, không có số cứng.
 */
export function getMonthlyClosings(): MonthClosing[] {
  const db = getDb();
  const keys = monthKeys();
  if (!keys.length) return [];

  // Sổ quỹ bắt đầu muộn hơn kho xe thì các tháng trước đó không thể cân được —
  // đánh dấu để bảng nói thẳng ra thay vì lặng lẽ lệch.
  const ledgerStart = (
    db.prepare(`SELECT MIN(at) AS t FROM ledger`).get() as { t: string | null }
  ).t;
  const thisMonth = todayKey().slice(0, 7);

  const rows: MonthClosing[] = [];
  let open = snapshotAt(monthStart(keys[0]));

  for (const key of keys) {
    const from = monthStart(key);
    const to = monthStart(nextMonthKey(key));
    const close = snapshotAt(to);

    const cars = db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(profit), 0) AS s
         FROM vehicles WHERE sold_at >= ? AND sold_at < ?`,
      )
      .get(from, to) as { n: number; s: number };
    const imports = db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(purchase_price), 0) AS s
         FROM vehicles WHERE imported_at >= ? AND imported_at < ?`,
      )
      .get(from, to) as { n: number; s: number };

    const capitalIn = sumKinds(from, to, ["ig_buy"]);
    const capitalOut = -sumKinds(from, to, ["ig_sell"]);
    const otherNet = sumKinds(from, to, ["expense", "income"]);
    const adjust = sumKinds(from, to, ["adjust"]);

    const profit = cars.s + otherNet;
    const expected = open.netWorth + capitalIn - capitalOut + profit + adjust;

    rows.push({
      key,
      label: formatMonthLabel(key),
      open: open.netWorth,
      openSnapshot: open,
      capitalIn,
      capitalOut,
      carProfit: cars.s,
      soldCount: cars.n,
      importedCount: imports.n,
      importCost: imports.s,
      otherNet,
      adjust,
      profit,
      close: close.netWorth,
      closeSnapshot: close,
      expected,
      gap: close.netWorth - expected,
      roi: open.netWorth > 0 ? profit / open.netWorth : null,
      // Sổ quỹ phải phủ trọn tháng thì phương trình mới có quyền cân bằng.
      tracked: ledgerStart != null && ledgerStart <= from,
      running: key === thisMonth,
    });

    open = close; // vốn cuối tháng này là vốn đầu tháng sau
  }

  return rows.reverse(); // mới nhất lên đầu
}
