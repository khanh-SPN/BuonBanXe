// Merges the SQLite WAL into data/inventory.db so the tracked file always
// holds the latest committed rows before git snapshots it.
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const dbPath = path.join(__dirname, "..", "data", "inventory.db");
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
db.close();
