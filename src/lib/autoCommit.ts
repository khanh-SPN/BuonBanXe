// Backs up the project (code + data/inventory.db) to git while the app is
// running. Runs as a plain interval inside the Next.js server process — no
// external scheduler, no spawned console window — so it's only ever active
// when the web app itself is up, and stops the moment the server stops.
import { execFile } from "node:child_process";
import { getDb } from "./db";

const INTERVAL_MS = 10 * 60 * 1000;
const REPO_ROOT = process.cwd();

declare global {
  // eslint-disable-next-line no-var
  var __buonBanXeAutoCommitTimer: NodeJS.Timeout | undefined;
}

function git(args: string[]): Promise<number> {
  return new Promise((resolve) => {
    execFile(
      "git",
      args,
      { cwd: REPO_ROOT, windowsHide: true },
      (err) => resolve(err ? (typeof err.code === "number" ? err.code : 1) : 0),
    );
  });
}

async function tick() {
  try {
    getDb().exec("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch {
    // best-effort — a stuck checkpoint shouldn't block the backup loop
  }

  await git(["add", "-A"]);
  const noChanges = (await git(["diff", "--cached", "--quiet"])) === 0;
  if (noChanges) return;

  const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  await git(["commit", "-m", `Auto backup: ${stamp}`, "--quiet"]);
  console.log(`[auto-backup] committed changes at ${stamp}`);
}

export function startAutoCommit() {
  if (globalThis.__buonBanXeAutoCommitTimer) return;
  console.log("[auto-backup] active — checking for changes every 10 minutes while the app is running");
  const timer = setInterval(() => {
    tick().catch(() => {});
  }, INTERVAL_MS);
  timer.unref();
  globalThis.__buonBanXeAutoCommitTimer = timer;
}
