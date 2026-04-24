"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  type LeadInstallmentRecord,
  type LeadInvoiceRecord,
  type InstallmentStatus,
  type InvoiceStatus,
} from "../lib/crm-api";
import styles from "./board-shell.module.css";

type TaskWalletItem = {
  id: string;
  description: string;
  cost: number;
  revenue: number;
};

type TaskWalletSnapshot = {
  id: string;
  title: string;
  status?: "in_progress" | "done";
  walletItems?: TaskWalletItem[];
};

type Props = {
  leadName: string;
  tasks: TaskWalletSnapshot[];
  invoices: LeadInvoiceRecord[];
  message?: string | null;
  onAddInvoice: () => void;
  onUpdateInvoice: (invoiceId: string, patch: Partial<LeadInvoiceRecord>) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onAddInstallment: (invoiceId: string) => void;
  onUpdateInstallment: (
    invoiceId: string,
    installmentId: string,
    patch: Partial<LeadInstallmentRecord>
  ) => void;
  onDeleteInstallment: (invoiceId: string, installmentId: string) => void;
};

const invoiceStatuses: InvoiceStatus[] = ["draft", "pending", "partial", "paid", "overdue", "cancelled"];
const installmentStatuses: InstallmentStatus[] = ["pending", "paid", "overdue"];

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function parseMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateWalletTotals(items?: TaskWalletItem[]) {
  return (items ?? []).reduce(
    (totals, item) => ({
      cost: totals.cost + parseMoney(item.cost),
      revenue: totals.revenue + parseMoney(item.revenue),
    }),
    { cost: 0, revenue: 0 }
  );
}

export function LeadWalletPanel({
  leadName,
  tasks,
  invoices,
  message,
  onAddInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  onAddInstallment,
  onUpdateInstallment,
  onDeleteInstallment,
}: Props) {
  const inProgressRevenue = tasks
    .filter((task) => task.status !== "done")
    .reduce((sum, task) => sum + calculateWalletTotals(task.walletItems).revenue, 0);

  const totalInvoiced = invoices.reduce((sum, invoice) => sum + parseMoney(invoice.amount), 0);
  const totalPending = invoices.reduce(
    (sum, invoice) =>
      sum +
      invoice.installments
        .filter((installment) => installment.status === "pending" || installment.status === "overdue")
        .reduce((installmentSum, installment) => installmentSum + parseMoney(installment.amount), 0),
    0
  );
  const totalPaid = invoices.reduce(
    (sum, invoice) =>
      sum +
      invoice.installments
        .filter((installment) => installment.status === "paid")
        .reduce((installmentSum, installment) => installmentSum + parseMoney(installment.amount), 0),
    0
  );
  const totalOverdue = invoices.reduce(
    (sum, invoice) =>
      sum +
      invoice.installments
        .filter((installment) => installment.status === "overdue")
        .reduce((installmentSum, installment) => installmentSum + parseMoney(installment.amount), 0),
    0
  );

  return (
    <section className={styles.walletLeadSection}>
      <div className={styles.sectionTitleRow}>
        <div>
          <h3>My Wallet</h3>
          <p className={styles.walletSectionHint}>{leadName || "Lead"} financial view and installments.</p>
        </div>
        <button type="button" onClick={onAddInvoice} aria-label="Add invoice">
          <Plus size={18} />
        </button>
      </div>

      <div className={styles.walletSummaryGrid}>
        <article>
          <span>Suggested to invoice</span>
          <strong>{formatMoney(inProgressRevenue)}</strong>
        </article>
        <article>
          <span>Total invoiced</span>
          <strong>{formatMoney(totalInvoiced)}</strong>
        </article>
        <article>
          <span>Pending installments</span>
          <strong>{formatMoney(totalPending)}</strong>
        </article>
        <article>
          <span>Paid installments</span>
          <strong>{formatMoney(totalPaid)}</strong>
        </article>
        <article>
          <span>Overdue</span>
          <strong>{formatMoney(totalOverdue)}</strong>
        </article>
      </div>

      {message ? <p className={styles.walletSectionMessage}>{message}</p> : null}

      <div className={styles.invoiceStack}>
        {invoices.map((invoice) => {
          const allocatedAmount = invoice.installments.reduce((sum, installment) => sum + parseMoney(installment.amount), 0);
          const remainingAmount = parseMoney(invoice.amount) - allocatedAmount;

          return (
            <article key={invoice.id} className={styles.invoiceCard}>
              <div className={styles.invoiceHeaderRow}>
                <input
                  value={invoice.title}
                  onChange={(event) => onUpdateInvoice(invoice.id, { title: event.target.value })}
                  placeholder="Invoice title"
                />
                <select
                  value={invoice.status ?? "pending"}
                  onChange={(event) =>
                    onUpdateInvoice(invoice.id, { status: event.target.value as InvoiceStatus })
                  }
                >
                  {invoiceStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => onDeleteInvoice(invoice.id)} aria-label="Delete invoice">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className={styles.invoiceGrid}>
                <label>
                  <span>Amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={invoice.amount}
                    onChange={(event) => onUpdateInvoice(invoice.id, { amount: Number(event.target.value) })}
                  />
                </label>
                <label>
                  <span>Issued at</span>
                  <input
                    type="date"
                    value={invoice.issuedAt ?? ""}
                    onChange={(event) => onUpdateInvoice(invoice.id, { issuedAt: event.target.value })}
                  />
                </label>
                <label>
                  <span>Due date</span>
                  <input
                    type="date"
                    value={invoice.dueDate ?? ""}
                    onChange={(event) => onUpdateInvoice(invoice.id, { dueDate: event.target.value })}
                  />
                </label>
              </div>

              <label className={styles.invoiceNotesField}>
                <span>Notes</span>
                <textarea
                  value={invoice.notes ?? ""}
                  onChange={(event) => onUpdateInvoice(invoice.id, { notes: event.target.value })}
                  placeholder="Invoice notes..."
                />
              </label>

              <div className={styles.invoiceMetaRow}>
                <span>Linked tasks: {invoice.sourceTaskIds?.length ?? 0}</span>
                <span>Remaining to allocate: {formatMoney(remainingAmount)}</span>
              </div>

              <div className={styles.installmentsHeader}>
                <h4>Installments</h4>
                <button type="button" onClick={() => onAddInstallment(invoice.id)}>
                  <Plus size={16} />
                  Add installment
                </button>
              </div>

              <div className={styles.installmentStack}>
                {invoice.installments.map((installment) => (
                  <div key={installment.id} className={styles.installmentRow}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={installment.amount}
                      onChange={(event) =>
                        onUpdateInstallment(invoice.id, installment.id, { amount: Number(event.target.value) })
                      }
                      placeholder="Amount"
                    />
                    <input
                      type="date"
                      value={installment.dueDate ?? ""}
                      onChange={(event) =>
                        onUpdateInstallment(invoice.id, installment.id, { dueDate: event.target.value })
                      }
                    />
                    <select
                      value={installment.status ?? "pending"}
                      onChange={(event) =>
                        onUpdateInstallment(invoice.id, installment.id, {
                          status: event.target.value as InstallmentStatus,
                        })
                      }
                    >
                      {installmentStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => onDeleteInstallment(invoice.id, installment.id)}
                      aria-label="Delete installment"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                {invoice.installments.length === 0 ? (
                  <p className={styles.leadEmptyState}>No installments created for this invoice yet.</p>
                ) : null}
              </div>
            </article>
          );
        })}

        {invoices.length === 0 ? <p className={styles.leadEmptyState}>No invoices for this lead yet.</p> : null}
      </div>
    </section>
  );
}
