"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { SidePanel } from "@/components/SidePanel";
import type { StatsPayload } from "@/lib/format";

export function AppShell() {
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"chat" | "inventory">("chat");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) return;
      setStats(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh stats khi switch sang tab inventory
  useEffect(() => {
    if (activeTab === "inventory") {
      refresh();
    }
  }, [activeTab, refresh]);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(196,112,45,0.22),transparent_68%)] blur-2xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(56,120,110,0.14),transparent_70%)] blur-2xl" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22%3E%3Cpath d=%22M0 60L60 0M30 60L60 30M0 30L30 0%22 stroke=%22rgba(255,255,255,0.03)%22 stroke-width=%221%22/%3E%3C/svg%3E')] opacity-80" />
      </div>

      <header className="relative z-10 border-b border-[var(--line)] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--ink)] sm:text-3xl">
              Buôn Bán Xe
            </p>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              Chat lệnh · bảng kho · 48 giờ · thuế 5%
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 rounded-lg border border-[var(--line)] bg-[var(--chip)] p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("chat")}
                className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                  activeTab === "chat"
                    ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("inventory")}
                className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                  activeTab === "inventory"
                    ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                Bảng kho
              </button>
            </div>
            <button
              type="button"
              onClick={() => refresh()}
              className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-xs text-[var(--ink-soft)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Làm mới
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[1600px] flex-1 p-3 lg:p-5">
        {activeTab === "chat" ? (
          <div className="h-[calc(100dvh-8rem)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]/95 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm animate-rise">
            <ChatPanel onRefresh={refresh} />
          </div>
        ) : (
          <div className="h-[calc(100dvh-8rem)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]/95 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-sm animate-rise">
            <SidePanel stats={stats} loading={loading} />
          </div>
        )}
      </main>
    </div>
  );
}
