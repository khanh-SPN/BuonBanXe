"use client";

import { useCallback, useState } from "react";
import type { AppState } from "@/lib/types";
import { formatIg, formatVnd, vndFromIg } from "@/lib/money";
import type { Api, ApiResult } from "@/components/ui";
import { Overview } from "@/components/tabs/Overview";
import { VehiclesTab } from "@/components/tabs/VehiclesTab";
import { IgTab } from "@/components/tabs/IgTab";
import { CashTab } from "@/components/tabs/CashTab";
import { DebtsTab } from "@/components/tabs/DebtsTab";
import { ReportTab } from "@/components/tabs/ReportTab";
import { SettingsTab } from "@/components/tabs/SettingsTab";

const TABS = [
  { key: "overview", label: "Tổng quan", icon: "🏠" },
  { key: "vehicles", label: "Kho xe", icon: "🚗" },
  { key: "ig", label: "Mua bán IG", icon: "💱" },
  { key: "cash", label: "Chi tiêu", icon: "🧾" },
  { key: "debts", label: "Nợ", icon: "🤝" },
  { key: "report", label: "Báo cáo", icon: "📊" },
  { key: "settings", label: "Cài đặt", icon: "⚙️" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function AppShell({ initialState }: { initialState: AppState }) {
  const [state, setState] = useState<AppState>(initialState);
  const [tab, setTab] = useState<TabKey>("overview");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state");
    if (res.ok) setState(await res.json());
  }, []);

  // Chỉ tải lại khi mở trang / đổi tab / sau mỗi thao tác — không tự động chạy nền.
  const openTab = useCallback(
    (next: TabKey) => {
      setTab(next);
      refresh();
    },
    [refresh],
  );

  const notify = useCallback((message: string, ok = true) => {
    setToast({ message, ok });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const send = useCallback(
    async (url: string, body: unknown): Promise<ApiResult> => {
      setBusy(true);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as ApiResult;
        notify(data.message ?? (data.ok ? "Xong." : "Có lỗi xảy ra."), data.ok);
        if (data.ok) await refresh();
        return data;
      } catch {
        notify("Không kết nối được server.", false);
        return { ok: false, message: "Không kết nối được server." };
      } finally {
        setBusy(false);
      }
    },
    [notify, refresh],
  );

  const api: Api = { state, busy, refresh, notify, send };

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(196,112,45,0.22),transparent_68%)] blur-2xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(56,120,110,0.14),transparent_70%)] blur-2xl" />
      </div>

      <header className="relative z-10 border-b border-[var(--line)] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--ink)]">
              Buôn Bán Xe
            </span>
            <span className="text-xs text-[var(--muted)]">rate {state.rate}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-2">
              <p className="eyebrow">Ví IG</p>
              <p className={`tnum text-xl font-semibold ${state.wallet.ig < 0 ? "text-[var(--bad)]" : "text-[var(--good)]"}`}>
                {formatIg(state.wallet.ig)}
              </p>
              <p className="text-[10.5px] text-[var(--muted)]">
                ≈ {formatVnd(vndFromIg(state.wallet.ig, state.rate))} tiền thật
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-2">
              <p className="eyebrow">Ví tiền thật</p>
              <p className={`tnum text-xl font-semibold ${state.wallet.vnd < 0 ? "text-[var(--bad)]" : "text-[var(--ink)]"}`}>
                {formatVnd(state.wallet.vnd)}
              </p>
              <p className="text-[10.5px] text-[var(--muted)]">từ mua / bán IG</p>
            </div>
            <button type="button" className="btn" onClick={() => refresh()} disabled={busy}>
              ↻ Làm mới
            </button>
          </div>
        </div>

        <nav className="mx-auto mt-3 flex max-w-[1500px] gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`tab-btn ${tab === t.key ? "on" : ""}`}
              onClick={() => openTab(t.key)}
            >
              <span className="mr-1.5">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[1500px] flex-1 p-3 sm:p-5">
        {tab === "overview" && <Overview api={api} onJump={openTab} />}
        {tab === "vehicles" && <VehiclesTab api={api} />}
        {tab === "ig" && <IgTab api={api} />}
        {tab === "cash" && <CashTab api={api} />}
        {tab === "debts" && <DebtsTab api={api} />}
        {tab === "report" && <ReportTab api={api} />}
        {tab === "settings" && <SettingsTab api={api} />}
      </main>

      {toast && <div className={`toast ${toast.ok ? "ok" : "err"}`}>{toast.message}</div>}
    </div>
  );
}
