import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

export type {
  Vehicle,
  VehicleStatus,
  VehicleImage,
  LedgerEntry,
  LedgerKind,
  LedgerRefType,
  IgTrade,
  Debt,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "inventory.db");

declare global {
   
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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      kind TEXT NOT NULL,
      category TEXT,
      label TEXT NOT NULL,
      ig_delta INTEGER NOT NULL DEFAULT 0,
      vnd_delta INTEGER NOT NULL DEFAULT 0,
      ref_type TEXT,
      ref_id INTEGER,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ig_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      side TEXT NOT NULL,
      rate REAL NOT NULL,
      vnd_amount INTEGER NOT NULL,
      ig_amount INTEGER NOT NULL,
      method TEXT,
      counterparty TEXT,
      note TEXT,
      at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      direction TEXT NOT NULL,
      person TEXT NOT NULL,
      ig_amount INTEGER NOT NULL,
      paid_ig INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'đang nợ',
      note TEXT,
      at TEXT NOT NULL,
      settled_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vehicle_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
    CREATE INDEX IF NOT EXISTS idx_vehicles_name ON vehicles(name);
    CREATE INDEX IF NOT EXISTS idx_vehicles_imported ON vehicles(imported_at);
    CREATE INDEX IF NOT EXISTS idx_vehicles_sold ON vehicles(sold_at);
    CREATE INDEX IF NOT EXISTS idx_ledger_at ON ledger(at);
    CREATE INDEX IF NOT EXISTS idx_ledger_ref ON ledger(ref_type, ref_id);
    CREATE INDEX IF NOT EXISTS idx_images_vehicle ON vehicle_images(vehicle_id);
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
