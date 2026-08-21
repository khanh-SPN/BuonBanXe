"use client";

import { useCallback, useRef, useState } from "react";
import type { AppState } from "@/lib/types";
import type { Api, ApiResult } from "@/components/ui";
import { WalletBar } from "@/components/WalletBar";
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

type ToastItem = { id: number; message: string; ok: boolean };

/** Tia than bay lên — giá trị cố định để không lệch khi render server/client. */
const EMBERS = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 61 + 13) % 100,
  size: 2 + ((i * 7) % 4),
  delay: (i * 0.93) % 9,
  duration: 8 + ((i * 13) % 7),
  drift: ((i * 29) % 60) - 30,
  color: i % 3 === 0 ? "#fbbf24" : i % 3 === 1 ? "#67e8f9" : "#38bdf8",
}));

/** Điểm sáng bạc bay lên — giá trị cố định. */
const SPARKS = Array.from({ length: 12 }, (_, i) => ({
  left: (i * 83 + 7) % 100,
  size: 1.5 + ((i * 5) % 3),
  delay: (i * 1.17) % 10,
  duration: 9 + ((i * 11) % 6),
  drift: ((i * 37) % 50) - 25,
}));

function FlameLogo() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="brand-flame" aria-hidden>
      <defs>
        <linearGradient id="flameGrad" x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="55%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      <path
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
        stroke="url(#flameGrad)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 21c-1.7 0-3-1.3-3-3 0-1.5 1-2.5 1.9-3.5.5-.6.9-1.2 1.1-2 .9 1.3 3 3 3 5.5 0 1.7-1.3 3-3 3z"
        fill="url(#flameGrad)"
        opacity="0.85"
      />
    </svg>
  );
}

function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="bg-gif" />
      <div className="bg-grid absolute inset-0" />
      <div className="orb orb-cyan -top-28 left-[8%] h-80 w-[40rem]" />
      <div className="orb orb-gold -top-20 right-[4%] h-72 w-[30rem]" />
      <div className="orb orb-blue bottom-[-8rem] left-1/2 h-96 w-[52rem] -translate-x-1/2" />
      {EMBERS.map((e, i) => (
        <span
          key={i}
          className="ember"
          style={{
            left: `${e.left}%`,
            width: e.size,
            height: e.size,
            background: e.color,
            boxShadow: `0 0 ${e.size * 3}px ${e.color}`,
            animationDuration: `${e.duration}s`,
            animationDelay: `${e.delay}s`,
            ["--drift" as string]: `${e.drift}px`,
          }}
        />
      ))}
      {SPARKS.map((s, i) => (
        <span
          key={`spark-${i}`}
          className="spark"
          style={{
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
            ["--drift" as string]: `${s.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

export function AppShell({ initialState }: { initialState: AppState }) {
  const [state, setState] = useState<AppState>(initialState);
  const [tab, setTab] = useState<TabKey>("overview");
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

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
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, message, ok }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4200);
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
      <Background />
      {busy && <div className="busy-bar" />}

      <header className="app-header relative z-10 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FlameLogo />
            <div className="flex flex-col">
              <span className="brand-title rgb-text text-2xl leading-tight tracking-tight">Buôn Bán Xe</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                Kho xe · IG · Sổ quỹ
              </span>
            </div>
            <button type="button" className="btn btn-sm ml-2" onClick={() => refresh()} disabled={busy}>
              ↻ Làm mới
            </button>
          </div>

          <WalletBar api={api} />
        </div>

        <nav className="mx-auto mt-3 flex max-w-[1500px] gap-1 overflow-x-auto pb-0.5">
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
        <div key={tab} className="animate-fade-up">
          {tab === "overview" && <Overview api={api} onJump={openTab} />}
          {tab === "vehicles" && <VehiclesTab api={api} />}
          {tab === "ig" && <IgTab api={api} />}
          {tab === "cash" && <CashTab api={api} />}
          {tab === "debts" && <DebtsTab api={api} />}
          {tab === "report" && <ReportTab api={api} />}
          {tab === "settings" && <SettingsTab api={api} />}
        </div>
      </main>

      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.ok ? "ok" : "err"}`} role="status">
            <span className={`toast-icon ${t.ok ? "ok" : "err"}`}>{t.ok ? "✓" : "✕"}</span>
            <span className="toast-msg">{t.message}</span>
            <span className="toast-bar" />
          </div>
        ))}
      </div>
    </div>
  );
}