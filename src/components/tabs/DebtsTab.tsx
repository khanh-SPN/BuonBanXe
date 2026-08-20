"use client";

import { useState } from "react";
import type { Debt } from "@/lib/types";
import { formatIg, parseMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";
import {
  type Api,
  DateTimePicker,
  Empty,
  Field,
  Modal,
  MoneyInput,
  Toggle,
  buildAt,
  nowTime,
  todayDate,
} from "@/components/ui";

export function DebtsTab({ api }: { api: Api }) {
  const { state } = api;
  const [direction, setDirection] = useState<"cho_vay" | "di_vay">("cho_vay");
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [useTime, setUseTime] = useState(false);
  const [date, setDate] = useState(todayDate());
  const [time, setTime] = useState(nowTime());
  const [paying, setPaying] = useState<Debt | null>(null);

  const value = parseMoney(amount) ?? 0;
  const valid = !!person.trim() && value > 0;

  async function submit() {
    const res = await api.send("/api/debt", {
      direction,
      person,
      igAmount: amount,
      note: note || undefined,
      at: useTime ? buildAt(date, time) : undefined,
    });
    if (res.ok) {
      setPerson("");
      setAmount("");
      setNote("");
    }
  }

  const open = state.debts.list.filter((d) => d.status === "đang nợ");
  const done = state.debts.list.filter((d) => d.status === "xong");

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <div className="card">
        <div className="card-head">
          <h3>🤝 Ghi một khoản nợ</h3>
        </div>
        <div className="grid gap-3.5 p-4">
          <Toggle
            value={direction}
            onChange={setDirection}
            options={[
              { value: "cho_vay", label: "Người khác vay mình" },
              { value: "di_vay", label: "Mình đi vay" },
            ]}
          />
          <Field label={direction === "cho_vay" ? "Người vay" : "Vay của ai"} required>
            <input className="input" value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Tên người" />
          </Field>
          <MoneyInput label="Số tiền" value={amount} onChange={setAmount} required />
          <Field label="Ghi chú">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="hẹn trả cuối tuần…" />
          </Field>
          <DateTimePicker on={useTime} setOn={setUseTime} date={date} setDate={setDate} time={time} setTime={setTime} />
          {value > 0 && (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--chip)] px-3 py-2 text-[12.5px]">
              {direction === "cho_vay" ? (
                <>
                  Ví trừ <span className="text-[var(--bad)]">{formatIg(value)}</span>, ghi nợ người này.
                </>
              ) : (
                <>
                  Ví cộng <span className="text-[var(--good)]">{formatIg(value)}</span>, mình nợ lại.
                </>
              )}
            </div>
          )}
          <button type="button" className="btn btn-primary" onClick={submit} disabled={!valid || api.busy}>
            {api.busy ? "Đang lưu…" : "Ghi khoản nợ"}
          </button>
        </div>
      </div>

      <div className="grid content-start gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card card-pad">
            <p className="eyebrow">Người ta nợ mình</p>
            <p className="tnum mt-1 text-lg font-semibold text-[var(--good)]">{formatIg(state.debts.owedToMe)}</p>
            <p className="text-[11px] text-[var(--muted)]">
              {open.filter((d) => d.direction === "cho_vay").length} khoản chưa đòi
            </p>
          </div>
          <div className="card card-pad">
            <p className="eyebrow">Mình nợ người ta</p>
            <p className="tnum mt-1 text-lg font-semibold text-[var(--bad)]">{formatIg(state.debts.iOwe)}</p>
            <p className="text-[11px] text-[var(--muted)]">
              {open.filter((d) => d.direction === "di_vay").length} khoản chưa trả
            </p>
          </div>
        </div>

        <DebtList
          title="Đang nợ"
          rows={open}
          api={api}
          onPay={setPaying}
          empty="Không ai đang nợ và mình cũng không nợ ai."
        />
        {done.length > 0 && <DebtList title="Đã xong" rows={done} api={api} onPay={setPaying} empty="" />}
      </div>

      {paying && <PayModal api={api} debt={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}

function DebtList({
  title,
  rows,
  api,
  onPay,
  empty,
}: {
  title: string;
  rows: Debt[];
  api: Api;
  onPay: (d: Debt) => void;
  empty: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="card-head">
        <h3>{title}</h3>
        <span className="text-[11px] text-[var(--muted)]">{rows.length} khoản</span>
      </div>
      {rows.length === 0 ? (
        <Empty>{empty}</Empty>
      ) : (
        <div className="max-h-[52vh] overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Chiều</th>
                <th>Người</th>
                <th className="text-right">Số tiền</th>
                <th className="text-right">Đã trả</th>
                <th className="text-right">Còn lại</th>
                <th>Ngày</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const remain = d.ig_amount - d.paid_ig;
                return (
                  <tr key={d.id}>
                    <td>
                      <span className={`status-pill ${d.direction === "cho_vay" ? "status-stock" : "status-deposit"}`}>
                        {d.direction === "cho_vay" ? "Cho vay" : "Đi vay"}
                      </span>
                    </td>
                    <td>
                      <span className="text-[var(--ink)]">{d.person}</span>
                      {d.note && <p className="text-[10.5px] text-[var(--muted)]">{d.note}</p>}
                    </td>
                    <td className="tnum text-right">{formatIg(d.ig_amount)}</td>
                    <td className="tnum text-right text-[var(--muted)]">{formatIg(d.paid_ig)}</td>
                    <td className={`tnum text-right ${remain > 0 ? "text-[var(--warn)]" : "text-[var(--good)]"}`}>
                      {formatIg(remain)}
                    </td>
                    <td className="nowrap text-[11px] text-[var(--muted)]">{formatDateTime(d.at)}</td>
                    <td>
                      <div className="flex gap-1.5">
                        {d.status === "đang nợ" && (
                          <button type="button" className="btn btn-sm" onClick={() => onPay(d)} disabled={api.busy}>
                            {d.direction === "cho_vay" ? "Thu nợ" : "Trả nợ"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          disabled={api.busy}
                          onClick={() => {
                            if (confirm(`Xoá khoản nợ với ${d.person}? Ví sẽ được hoàn lại như chưa từng ghi.`)) {
                              api.send("/api/debt", { action: "delete", id: d.id });
                            }
                          }}
                        >
                          Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PayModal({ api, debt, onClose }: { api: Api; debt: Debt; onClose: () => void }) {
  const remain = debt.ig_amount - debt.paid_ig;
  const [amount, setAmount] = useState(String(remain));
  const value = Math.min(parseMoney(amount) ?? 0, remain);

  async function submit() {
    const res = await api.send("/api/debt", { action: "pay", id: debt.id, amount });
    if (res.ok) onClose();
  }

  return (
    <Modal
      title={debt.direction === "cho_vay" ? `${debt.person} trả nợ` : `Trả nợ ${debt.person}`}
      icon="💵"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-primary flex-1" onClick={submit} disabled={value <= 0 || api.busy}>
            Xác nhận
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Huỷ
          </button>
        </>
      }
    >
      <div className="rounded-xl border border-[var(--line)] bg-[var(--chip)] px-3 py-2 text-[12.5px]">
        Tổng nợ {formatIg(debt.ig_amount)} · đã trả {formatIg(debt.paid_ig)} · còn{" "}
        <span className="font-semibold text-[var(--warn)]">{formatIg(remain)}</span>
      </div>
      <MoneyInput label="Số tiền lần này" value={amount} onChange={setAmount} autoFocus hint="Trả góp từng phần cũng được." />
      {value > 0 && (
        <p className="text-[12px] text-[var(--muted)]">
          {debt.direction === "cho_vay" ? "Ví cộng " : "Ví trừ "}
          <span className={debt.direction === "cho_vay" ? "text-[var(--good)]" : "text-[var(--bad)]"}>
            {formatIg(value)}
          </span>
          {value >= remain ? " · khoản này sẽ tất toán." : ` · còn lại ${formatIg(remain - value)}.`}
        </p>
      )}
    </Modal>
  );
}
