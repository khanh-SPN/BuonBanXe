import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

export type VehicleStatus = "Còn hàng" | "đã đặt cọc" | "Đã bán hết";

export interface Vehicle {
  id: number;
  name: string;
  purchase_price: number;
  expected_price: number;
  agreed_price: number | null;
  actual_price: number | null;
  status: VehicleStatus;
  customer_name: string | null;
  note: string | null;
  profit: number | null;
  deposit_amount: number | null;
  imported_at: string;
  deposit_at: string | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "inventory.db");

declare global {
  // eslint-disable-next-line no-var
  var __buonBanXeDb: DatabaseSync | undefined;
}

function columnExists(db: DatabaseSync, table: string, column: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return rows.some((r) => r.name === column);
}

function ensureSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      purchase_price INTEGER NOT NULL,
      expected_price INTEGER NOT NULL,
      agreed_price INTEGER,
      actual_price INTEGER,
      status TEXT NOT NULL DEFAULT 'Còn hàng',
      customer_name TEXT,
      note TEXT,
      profit INTEGER,
      deposit_amount INTEGER,
      imported_at TEXT NOT NULL,
      deposit_at TEXT,
      sold_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
    CREATE INDEX IF NOT EXISTS idx_vehicles_name ON vehicles(name);
    CREATE INDEX IF NOT EXISTS idx_vehicles_imported ON vehicles(imported_at);
    CREATE INDEX IF NOT EXISTS idx_vehicles_sold ON vehicles(sold_at);
  `);

  if (!columnExists(db, "vehicles", "agreed_price")) {
    db.exec(`ALTER TABLE vehicles ADD COLUMN agreed_price INTEGER`);
  }
  if (!columnExists(db, "vehicles", "customer_name")) {
    db.exec(`ALTER TABLE vehicles ADD COLUMN customer_name TEXT`);
  }
}

export function getDb(): DatabaseSync {
  if (globalThis.__buonBanXeDb) return globalThis.__buonBanXeDb;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  ensureSchema(db);
  globalThis.__buonBanXeDb = db;
  return db;
}
