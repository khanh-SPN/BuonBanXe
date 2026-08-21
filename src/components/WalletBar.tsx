"use client";

import { useState } from "react";
import { formatIg, formatVnd, groupDigits, parseMoney, parseRate, vndFromIg } from "@/lib/money";
import type { Api } from "@/components/ui";

/**
 * Thanh ví trên đầu trang: sửa rate ngay tại chỗ, và gõ thẳng số IG / tiền thật
 * đang có thật trong game để chốt lại số dư.
 */
export function WalletBar({ api }: { api: Api }) {
  const { state } = api;

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <RateBox key={state.rate} api={api} />
      <div className="flex flex-wrap gap-2.5">
        <WalletBox
          api={api}
          label="Ví IG đang có"
          field="walletIg"
          value={state.wallet.ig}
          format={formatIg}
          unit="IG"
          tone={state.wallet.ig < 0 ? "bad" : "good"}
          sub={`≈ ${formatVnd(vndFromIg(state.wallet.ig, state.rate))} tiền thật`}
        />
        <WalletBox
          api={api}
          label="Ví tiền thật"
          field="walletVnd"
          value={state.wallet.vnd}
          format={formatVnd}
          unit="đ"
          tone={state.wallet.vnd < 0 ? "bad" : "ink"}
          sub="từ mua / bán IG"
        />
      </div>
    </div>
  );
}

function RateBox({ api }: { api: Api }) {
  // Component được remount khi rate đổi (key ở WalletBar) nên state luôn khớp.
  const [text, setText] = useState(String(api.state.rate));

  const parsed = parseRate(text);
  const dirty = parsed != null && parsed !== api.state.rate;

  async function save() {
    if (!dirty) return;
    await api.send("/api/settings", { rate: text });
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-2)]/80 px-3 py-1.5 shadow-[0_0_18px_rgba(34,211,238,0.06)] transition focus-within:border-[var(--line-strong)] focus-within:shadow-[0_0_22px_rgba(34,211,238,0.16)]">
      <span className="eyebrow">Rate</span>
      <input
        className="input tnum w-[76px] px-2 py-1 text-center text-[13px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setText(String(api.state.rate));
        }}
        onBlur={save}
        placeholder="12.5"
        title="1 triệu VND đổi được bao nhiêu triệu IG"
      />
      <span className="text-[11px] text-[var(--muted)]">
        {parsed == null ? (
          <span className="text-[var(--bad)]">rate không hợp lệ</span>
        ) : (
          <>1tr VND = {String(parsed).replace(".", ",")}tr IG</>
        )}
      </span>
      {dirty && (
        <button type="button" className="btn btn-sm btn-primary" onClick={save} disabled={api.busy}>
          Lưu
        </button>
      )}
    </div>
  );
}

function WalletBox({
  api,
  label,
  field,
  value,
  format,
  unit,
  tone,
  sub,
}: {
  api: Api;
  label: string;
  field: "walletIg" | "walletVnd";
  value: number;
  format: (n: number) => string;
  unit: "IG" | "đ";
  tone: "good" | "bad" | "ink";
  sub: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  const parsed = text.trim() ? parseMoney(text) : null;
  const cls =
    tone === "bad" ? "text-[var(--bad)]" : tone === "good" ? "text-[var(--good)]" : "text-[var(--ink)]";

  function open() {
    setText(String(value));
    setEditing(true);
  }

  async function save() {
    if (parsed == null) return;
    const res = await api.send("/api/settings", { [field]: text });
    if (res.ok) setEditing(false);
  }

  return (
    <div className={`wallet-card min-w-[190px] px-4 py-2 ${field === "walletVnd" ? "wallet-vnd" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">{label}</p>
        {!editing && (
          <button
            type="button"
            className="text-[11px] text-[var(--muted)] transition hover:text-[var(--accent)]"
            onClick={open}
            title="Nhập số đang có thật trong game"
          >
            ✎ sửa
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-1">
          <div className="flex items-center gap-1.5">
            <input
              className="input tnum px-2 py-1 text-[15px]"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              placeholder={`10tr · 200k`}
            />
            <button type="button" className="btn btn-sm btn-primary" onClick={save} disabled={parsed == null || api.busy}>
              Lưu
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>
              Bỏ
            </button>
          </div>
          <p className="mt-1 text-[10.5px]">
            {parsed == null ? (
              <span className="text-[var(--bad)]">Không đọc được số này</span>
            ) : (
              <span className="hint-accent">
                = {groupDigits(parsed)} {unit} — chốt lại số dư, giao dịch cũ giữ nguyên
              </span>
            )}
          </p>
        </div>
      ) : (
        <>
          <button
            type="button"
            className={`tnum block text-left text-xl font-semibold ${cls} ${
              tone === "good" ? "glow-good" : tone === "bad" ? "glow-bad" : "glow-cyan"
            }`}
            onClick={open}
          >
            {format(value)}
          </button>
          <p className="text-[10.5px] text-[var(--muted)]">{sub}</p>
        </>
      )}
    </div>
  );
}
