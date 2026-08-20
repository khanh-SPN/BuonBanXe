"use client";

import { useState } from "react";
import { EXPECTED_MARKUP, TAX_LABEL, formatIg, formatVnd, igFromVnd, parseMoney, parseRate, vndFromIg } from "@/lib/money";
import { type Api, Field, MoneyInput } from "@/components/ui";

export function SettingsTab({ api }: { api: Api }) {
  const { state } = api;
  const [rateText, setRateText] = useState(String(state.rate));
  const [igText, setIgText] = useState("");
  const [vndText, setVndText] = useState("");

  const rate = parseRate(rateText);
  const igTarget = igText.trim() ? parseMoney(igText) : null;
  const vndTarget = vndText.trim() ? parseMoney(vndText) : null;

  async function saveRate() {
    if (rate == null) return;
    await api.send("/api/settings", { rate: rateText });
  }

  async function saveWallets() {
    const body: Record<string, string> = {};
    if (igText.trim()) body.walletIg = igText;
    if (vndText.trim()) body.walletVnd = vndText;
    const res = await api.send("/api/settings", body);
    if (res.ok) {
      setIgText("");
      setVndText("");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card">
        <div className="card-head">
          <h3>💱 Rate IG ↔ tiền thật</h3>
          <span className="text-[11px] text-[var(--muted)]">đang dùng: {state.rate}</span>
        </div>
        <div className="grid gap-3.5 p-4">
          <Field
            label="Rate"
            required
            hint={
              rate == null ? (
                <span className="text-[var(--bad)]">Rate không hợp lệ</span>
              ) : (
                <span className="hint-accent">
                  1.000.000đ = {formatIg(igFromVnd(1_000_000, rate))} · 1tr IG = {formatVnd(vndFromIg(1_000_000, rate))}
                </span>
              )
            }
          >
            <input className="input tnum" value={rateText} onChange={(e) => setRateText(e.target.value)} placeholder="12.5" />
          </Field>
          <p className="text-[12px] text-[var(--muted)]">
            Rate chỉ dùng để quy đổi và gợi ý khi mua/bán IG. Các giao dịch IG cũ vẫn giữ nguyên rate lúc ghi.
          </p>
          <button type="button" className="btn btn-primary" onClick={saveRate} disabled={rate == null || api.busy}>
            Lưu rate
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>👛 Chốt số dư ví</h3>
        </div>
        <div className="grid gap-3.5 p-4">
          <p className="text-[12px] text-[var(--muted)]">
            Nhập đúng số tiền bạn <span className="text-[var(--ink)]">đang có thật trong game</span>, hệ thống sẽ tự
            khớp lại số dư đầu kỳ. Mọi giao dịch đã ghi vẫn giữ nguyên.
          </p>
          <MoneyInput
            label="Ví IG đang có"
            value={igText}
            onChange={setIgText}
            hint={`Hiện tại đang tính là ${formatIg(state.wallet.ig)}`}
          />
          <MoneyInput
            label="Ví tiền thật đang có"
            value={vndText}
            onChange={setVndText}
            unit="đ"
            hint={`Hiện tại đang tính là ${formatVnd(state.wallet.vnd)}`}
          />
          {(igTarget != null || vndTarget != null) && (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--chip)] px-3 py-2 text-[12.5px]">
              {igTarget != null && (
                <p>
                  Ví IG: {formatIg(state.wallet.ig)} → <span className="text-[var(--accent)]">{formatIg(igTarget)}</span>
                </p>
              )}
              {vndTarget != null && (
                <p>
                  Ví tiền thật: {formatVnd(state.wallet.vnd)} →{" "}
                  <span className="text-[var(--accent)]">{formatVnd(vndTarget)}</span>
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveWallets}
            disabled={api.busy || (!igText.trim() && !vndText.trim())}
          >
            Chốt số dư
          </button>
        </div>
      </div>

      <div className="card lg:col-span-2">
        <div className="card-head">
          <h3>📌 Luật đang áp dụng</h3>
        </div>
        <div className="grid gap-2 p-4 text-[13px] text-[var(--ink-soft)] sm:grid-cols-2">
          <p>• Xe nhập vào phải giữ đủ <span className="text-[var(--ink)]">48 giờ</span> mới bán được.</p>
          <p>• Giá bán dự kiến = giá nhập <span className="text-[var(--ink)]">+{Math.round((EXPECTED_MARKUP - 1) * 100)}%</span>.</p>
          <p>• Bán xe chịu thuế <span className="text-[var(--ink)]">{TAX_LABEL}</span> trên giá bán.</p>
          <p>• Lãi thực = giá bán − thuế − giá nhập.</p>
          <p>• Nhận cọc thì ví cộng ngay tiền cọc; khi bán chỉ cộng thêm phần còn lại.</p>
          <p>• Xoá xe / giao dịch IG / khoản nợ đều hoàn lại ví như chưa từng ghi.</p>
        </div>
      </div>

      <div className="card lg:col-span-2">
        <div className="card-head">
          <h3>💾 Dữ liệu</h3>
        </div>
        <div className="grid gap-2 p-4 text-[13px] text-[var(--ink-soft)]">
          <p>
            Toàn bộ dữ liệu nằm ở <code className="rounded bg-[var(--chip)] px-1.5 py-0.5 text-[12px]">data/inventory.db</code>{" "}
            trên máy bạn, ảnh xe nằm ở{" "}
            <code className="rounded bg-[var(--chip)] px-1.5 py-0.5 text-[12px]">public/uploads</code>.
          </p>
          <p className="text-[var(--muted)]">
            App tự backup lên GitHub mỗi 10 phút khi đang chạy — bao gồm cả database và ảnh.
          </p>
        </div>
      </div>
    </div>
  );
}
