"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import {
  getFinancialHealth,
  saveFinancialHealth,
  type FinancialEntry,
  type FinancialEntryKind,
  type TaskFinancialSummary,
} from "../lib/crm-api";
import styles from "./financial-health-shell.module.css";

const kindLabels: Record<FinancialEntryKind, string> = {
  fixed_cost: "Fixed costs",
  variable_cost: "Variable costs",
  revenue: "Revenue",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function createEntry(kind: FinancialEntryKind): FinancialEntry {
  return {
    id: `financial-${crypto.randomUUID()}`,
    kind,
    description: "",
    amount: 0,
    entryDate: today(),
    notes: "",
  };
}

function amount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function FinancialHealthShell() {
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [taskFinancials, setTaskFinancials] = useState<TaskFinancialSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    void getFinancialHealth()
      .then((response) => {
        if (!mounted) return;
        setEntries(response.entries);
        setTaskFinancials(response.taskFinancials);
      })
      .catch((error) => {
        if (mounted) setMessage(error instanceof Error ? error.message : "Could not load financial data.");
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const taskRevenue = useMemo(() => taskFinancials.reduce((sum, task) => sum + task.revenue, 0), [taskFinancials]);
  const taskVariableCosts = useMemo(() => taskFinancials.reduce((sum, task) => sum + task.cost, 0), [taskFinancials]);
  const manualFixedCosts = useMemo(
    () => entries.filter((entry) => entry.kind === "fixed_cost").reduce((sum, entry) => sum + entry.amount, 0),
    [entries]
  );
  const manualVariableCosts = useMemo(
    () => entries.filter((entry) => entry.kind === "variable_cost").reduce((sum, entry) => sum + entry.amount, 0),
    [entries]
  );
  const manualRevenue = useMemo(
    () => entries.filter((entry) => entry.kind === "revenue").reduce((sum, entry) => sum + entry.amount, 0),
    [entries]
  );
  const totalRevenue = taskRevenue + manualRevenue;
  const totalCosts = manualFixedCosts + manualVariableCosts + taskVariableCosts;
  const netResult = totalRevenue - totalCosts;

  function updateEntry(id: string, patch: Partial<FinancialEntry>) {
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  function addEntry(kind: FinancialEntryKind) {
    setEntries((current) => [createEntry(kind), ...current]);
  }

  function removeEntry(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  async function save() {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await saveFinancialHealth(entries);
      setEntries(response.entries);
      setMessage("Financial data saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save financial data.");
    } finally {
      setIsSaving(false);
    }
  }

  const renderEntries = (kind: FinancialEntryKind) => {
    const items = entries.filter((entry) => entry.kind === kind);

    return (
      <section className={styles.entrySection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>{kindLabels[kind]}</h2>
            <p>{kind === "fixed_cost" ? "Recurring office expenses." : kind === "variable_cost" ? "Expenses that change with your work volume." : "Additional revenue not coming from task Wallets."}</p>
          </div>
          <button type="button" className={styles.addButton} onClick={() => addEntry(kind)}>
            <Plus size={16} /> Add
          </button>
        </div>
        <div className={styles.entryList}>
          {items.map((entry) => (
            <div className={styles.entryRow} key={entry.id}>
              <input
                value={entry.description}
                onChange={(event) => updateEntry(entry.id, { description: event.target.value })}
                placeholder="Description"
                aria-label={`${kindLabels[kind]} description`}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={entry.amount}
                onChange={(event) => updateEntry(entry.id, { amount: amount(event.target.value) })}
                placeholder="Amount"
                aria-label={`${kindLabels[kind]} amount`}
              />
              <input
                type="date"
                value={entry.entryDate ?? today()}
                onChange={(event) => updateEntry(entry.id, { entryDate: event.target.value })}
                aria-label={`${kindLabels[kind]} date`}
              />
              <button type="button" className={styles.deleteButton} onClick={() => removeEntry(entry.id)} aria-label="Delete entry">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {items.length === 0 ? <p className={styles.empty}>No entries yet.</p> : null}
        </div>
      </section>
    );
  };

  return (
    <main className={styles.page}>
      <nav className={styles.globalNav} aria-label="Primary navigation">
        <Link href="/dashboard" className={styles.backLink}><ArrowLeft size={16} /> Dashboard</Link>
      </nav>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Financial Health</p>
          <h1>Business financial health</h1>
          <p>See revenue from your service tasks alongside fixed and variable costs.</p>
        </div>
        <button type="button" className={styles.saveButton} onClick={() => void save()} disabled={isSaving || isLoading}>
          <Save size={16} /> {isSaving ? "Saving…" : "Save changes"}
        </button>
      </header>

      {message ? <p className={styles.message}>{message}</p> : null}

      <section className={styles.summaryGrid} aria-label="Financial summary">
        <article><span>Total revenue</span><strong>{money(totalRevenue)}</strong><small>{money(taskRevenue)} from tasks</small></article>
        <article><span>Fixed costs</span><strong>{money(manualFixedCosts)}</strong><small>Manual entries</small></article>
        <article><span>Variable costs</span><strong>{money(manualVariableCosts + taskVariableCosts)}</strong><small>{money(taskVariableCosts)} from task Wallets</small></article>
        <article className={netResult >= 0 ? styles.positive : styles.negative}><span>Net result</span><strong>{money(netResult)}</strong><small>Revenue minus costs</small></article>
      </section>

      <div className={styles.contentGrid}>
        <div className={styles.manualSections}>
          {renderEntries("fixed_cost")}
          {renderEntries("variable_cost")}
          {renderEntries("revenue")}
        </div>

        <aside className={styles.taskSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Revenue from tasks</h2>
              <p>Read-only values pulled from Wallet services.</p>
            </div>
          </div>
          {taskFinancials.length === 0 ? <p className={styles.empty}>No task revenue recorded yet.</p> : (
            <div className={styles.taskList}>
              {taskFinancials.map((task) => (
                <article className={styles.taskRow} key={task.taskId}>
                  <div><strong>{task.taskTitle}</strong><span>{task.services.length} service{task.services.length === 1 ? "" : "s"}</span></div>
                  <div><span>Revenue</span><strong>{money(task.revenue)}</strong></div>
                  <div><span>Cost</span><strong>{money(task.cost)}</strong></div>
                </article>
              ))}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
