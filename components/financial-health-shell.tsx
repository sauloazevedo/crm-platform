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

type CostKind = "fixed_cost" | "variable_cost";
type PeriodMonth = "all" | `${number}`;

const costLabels: Record<CostKind, string> = { fixed_cost: "Fixed costs", variable_cost: "Variable costs" };

function today() { return new Date().toISOString().slice(0, 10); }
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }
function toAmount(value: string) { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0; }
function createEntry(kind: CostKind): FinancialEntry { return { id: `financial-${crypto.randomUUID()}`, kind, description: "", amount: 0, entryDate: today(), notes: "" }; }
function isCostKind(kind: FinancialEntryKind): kind is CostKind { return kind === "fixed_cost" || kind === "variable_cost"; }
function dateParts(value?: string | null) { if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null; return { year: value.slice(0, 4), month: String(Number(value.slice(5, 7)) - 1) }; }
function formatDate(value?: string | null) { if (!value) return "No date"; const parsed = new Date(`${value.slice(0, 10)}T00:00:00Z`); return Number.isNaN(parsed.getTime()) ? "No date" : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); }

export function FinancialHealthShell() {
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [taskFinancials, setTaskFinancials] = useState<TaskFinancialSummary[]>([]);
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState<PeriodMonth>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void getFinancialHealth().then((response) => {
      if (!mounted) return;
      setEntries(response.entries);
      setTaskFinancials(response.taskFinancials);
    }).catch((error) => {
      if (mounted) setMessage(error instanceof Error ? error.message : "Could not load financial data.");
    }).finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  const years = useMemo(() => {
    const values = new Set<string>();
    entries.forEach((entry) => { const parts = dateParts(entry.entryDate); if (parts) values.add(parts.year); });
    taskFinancials.forEach((task) => { const parts = dateParts(task.taskDate); if (parts) values.add(parts.year); });
    return Array.from(values).sort((a, b) => Number(b) - Number(a));
  }, [entries, taskFinancials]);

  const matchesPeriod = (value?: string | null) => {
    const parts = dateParts(value);
    if (!parts) return selectedYear === "all" && selectedMonth === "all";
    return (selectedYear === "all" || parts.year === selectedYear) && (selectedMonth === "all" || parts.month === selectedMonth);
  };
  const visibleEntries = useMemo(() => entries.filter((entry) => isCostKind(entry.kind) && matchesPeriod(entry.entryDate)), [entries, selectedYear, selectedMonth]);
  const visibleTasks = useMemo(() => taskFinancials.filter((task) => matchesPeriod(task.taskDate)), [taskFinancials, selectedYear, selectedMonth]);
  const fixedCosts = useMemo(() => visibleEntries.filter((entry) => entry.kind === "fixed_cost").reduce((sum, entry) => sum + entry.amount, 0), [visibleEntries]);
  const manualVariableCosts = useMemo(() => visibleEntries.filter((entry) => entry.kind === "variable_cost").reduce((sum, entry) => sum + entry.amount, 0), [visibleEntries]);
  const taskRevenue = useMemo(() => visibleTasks.reduce((sum, task) => sum + task.revenue, 0), [visibleTasks]);
  const taskVariableCosts = useMemo(() => visibleTasks.reduce((sum, task) => sum + task.cost, 0), [visibleTasks]);
  const variableCosts = manualVariableCosts + taskVariableCosts;
  const totalCosts = fixedCosts + variableCosts;
  const netResult = taskRevenue - fixedCosts - variableCosts;

  const monthlyRows = useMemo(() => {
    const months = selectedMonth === "all" ? Array.from({ length: 12 }, (_, index) => String(index)) : [selectedMonth];
    return months.map((month) => {
      const monthEntries = entries.filter((entry) => isCostKind(entry.kind) && (selectedYear === "all" || dateParts(entry.entryDate)?.year === selectedYear) && dateParts(entry.entryDate)?.month === month);
      const monthTasks = taskFinancials.filter((task) => (selectedYear === "all" || dateParts(task.taskDate)?.year === selectedYear) && dateParts(task.taskDate)?.month === month);
      return {
        month,
        label: new Date(Date.UTC(2020, Number(month), 1)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
        revenue: monthTasks.reduce((sum, task) => sum + task.revenue, 0),
        fixed: monthEntries.filter((entry) => entry.kind === "fixed_cost").reduce((sum, entry) => sum + entry.amount, 0),
        variable: monthEntries.filter((entry) => entry.kind === "variable_cost").reduce((sum, entry) => sum + entry.amount, 0) + monthTasks.reduce((sum, task) => sum + task.cost, 0),
      };
    });
  }, [entries, taskFinancials, selectedYear, selectedMonth]);
  const chartMax = Math.max(1, ...monthlyRows.flatMap((row) => [row.revenue, row.fixed, row.variable]));
  const fixedShare = totalCosts > 0 ? (fixedCosts / totalCosts) * 100 : 0;
  const variableShare = totalCosts > 0 ? (variableCosts / totalCosts) * 100 : 0;
  const netMargin = taskRevenue > 0 ? (netResult / taskRevenue) * 100 : 0;
  const analysis = taskRevenue === 0
    ? "There is no Wallet revenue in the selected period yet. Add service revenue inside a task Wallet to complete the DRE."
    : netResult >= 0
      ? `The business generated ${money(taskRevenue)} in Wallet revenue and a positive result of ${money(netResult)} (${netMargin.toFixed(1)}% margin). ${fixedCosts > variableCosts ? "Fixed costs are the largest cost pressure." : "Variable costs are the largest cost pressure."}`
      : `Costs exceeded Wallet revenue by ${money(Math.abs(netResult))}. Review the latest expenses and the services with the highest Wallet costs before expanding this period.`;

  const recentExpenses = useMemo(() => {
    const manual = visibleEntries.map((entry) => ({ id: entry.id, date: entry.entryDate, description: entry.description, kind: costLabels[entry.kind as CostKind], amount: entry.amount, source: "Manual" }));
    const taskCosts = visibleTasks.flatMap((task) => task.services.filter((service) => service.cost > 0).map((service, index) => ({ id: `${task.taskId}-${index}`, date: task.taskDate, description: service.description || task.taskTitle, kind: "Task variable cost", amount: service.cost, source: task.taskTitle })));
    return [...manual, ...taskCosts].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? ""))).slice(0, 10);
  }, [visibleEntries, visibleTasks]);

  function updateEntry(id: string, patch: Partial<FinancialEntry>) { setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))); }
  function addEntry(kind: CostKind) { setEntries((current) => [createEntry(kind), ...current]); }
  function removeEntry(id: string) { setEntries((current) => current.filter((entry) => entry.id !== id)); }
  async function save() {
    setIsSaving(true); setMessage(null);
    try { const response = await saveFinancialHealth(entries); setEntries(response.entries); setMessage("DRE data saved."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save DRE data."); }
    finally { setIsSaving(false); }
  }

  const renderCostEntries = (kind: CostKind) => {
    const items = entries.filter((entry) => entry.kind === kind);
    return <section className={styles.entrySection}>
      <div className={styles.sectionHeader}><div><h2>{costLabels[kind]}</h2><p>{kind === "fixed_cost" ? "Recurring office expenses." : "Expenses that change with work volume."}</p></div><button type="button" className={styles.addButton} onClick={() => addEntry(kind)}><Plus size={16} /> Add</button></div>
      <div className={styles.entryList}>{items.map((entry) => <div className={styles.entryRow} key={entry.id}>
        <input value={entry.description} onChange={(event) => updateEntry(entry.id, { description: event.target.value })} placeholder="Description" aria-label={`${costLabels[kind]} description`} />
        <input type="number" min="0" step="0.01" value={entry.amount} onChange={(event) => updateEntry(entry.id, { amount: toAmount(event.target.value) })} placeholder="Amount" aria-label={`${costLabels[kind]} amount`} />
        <input type="date" value={entry.entryDate ?? today()} onChange={(event) => updateEntry(entry.id, { entryDate: event.target.value })} aria-label={`${costLabels[kind]} date`} />
        <button type="button" className={styles.deleteButton} onClick={() => removeEntry(entry.id)} aria-label="Delete expense"><Trash2 size={15} /></button>
      </div>)}{items.length === 0 ? <p className={styles.empty}>No entries yet.</p> : null}</div>
    </section>;
  };

  return <main className={styles.page}>
    <nav className={styles.globalNav} aria-label="Primary navigation"><Link href="/dashboard" className={styles.backLink}><ArrowLeft size={16} /> Dashboard</Link></nav>
    <header className={styles.header}><div><p className={styles.eyebrow}>Financial Health · DRE</p><h1>Business financial health</h1><p>Revenue comes exclusively from task Wallets. Costs are separated into fixed and variable expenses.</p></div><button type="button" className={styles.saveButton} onClick={() => void save()} disabled={isSaving || isLoading}><Save size={16} /> {isSaving ? "Saving…" : "Save changes"}</button></header>
    <section className={styles.filters} aria-label="DRE period"><label><span>Year</span><select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}><option value="all">All years</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label><label><span>Month</span><select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value as PeriodMonth)}><option value="all">All months</option>{Array.from({ length: 12 }, (_, index) => <option key={index} value={String(index)}>{new Date(Date.UTC(2020, index, 1)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })}</option>)}</select></label></section>
    {message ? <p className={styles.message}>{message}</p> : null}
    <section className={styles.summaryGrid} aria-label="DRE summary"><article className={styles.revenueCard}><span>Revenue from Wallet</span><strong>{money(taskRevenue)}</strong><small>{visibleTasks.length} task{visibleTasks.length === 1 ? "" : "s"} in period</small></article><article><span>Fixed costs</span><strong>{money(fixedCosts)}</strong><small>Manual entries</small></article><article><span>Variable costs</span><strong>{money(variableCosts)}</strong><small>{money(taskVariableCosts)} from task Wallets</small></article><article className={netResult >= 0 ? styles.positive : styles.negative}><span>Net result</span><strong>{money(netResult)}</strong><small>Revenue minus total costs</small></article></section>
    <section className={styles.chartSection}><div className={styles.sectionHeader}><div><h2>Monthly DRE</h2><p>Revenue and expenses by month for the selected year.</p></div></div><div className={styles.chart}>{monthlyRows.map((row) => <div className={styles.chartMonth} key={row.month}><div className={styles.chartBars}><span className={styles.revenueBar} style={{ height: `${(row.revenue / chartMax) * 100}%` }} title={`Revenue ${money(row.revenue)}`} /><span className={styles.fixedBar} style={{ height: `${(row.fixed / chartMax) * 100}%` }} title={`Fixed ${money(row.fixed)}`} /><span className={styles.variableBar} style={{ height: `${(row.variable / chartMax) * 100}%` }} title={`Variable ${money(row.variable)}`} /></div><small>{row.label}</small></div>)}</div><div className={styles.legend}><span><i className={styles.revenueDot} /> Revenue</span><span><i className={styles.fixedDot} /> Fixed costs</span><span><i className={styles.variableDot} /> Variable costs</span></div></section>
    <section className={styles.analysisGrid}><article className={styles.analysisCard}><h2>DRE analysis</h2><p>{analysis}</p></article><article className={styles.compositionCard}><div className={styles.sectionHeader}><div><h2>Cost composition</h2><p>Fixed versus variable costs in the selected period.</p></div></div><div className={styles.compositionBar}><span className={styles.fixedBar} style={{ width: `${fixedShare}%` }} /><span className={styles.variableBar} style={{ width: `${variableShare}%` }} /></div><div className={styles.compositionLabels}><span>Fixed {fixedShare.toFixed(1)}%</span><span>Variable {variableShare.toFixed(1)}%</span></div></article></section>
    <div className={styles.contentGrid}><div className={styles.manualSections}>{renderCostEntries("fixed_cost")}{renderCostEntries("variable_cost")}</div><aside className={styles.taskSection}><div className={styles.sectionHeader}><div><h2>Last 10 expenses</h2><p>Manual costs and Wallet service costs in the selected period.</p></div></div>{recentExpenses.length === 0 ? <p className={styles.empty}>No expenses recorded yet.</p> : <div className={styles.expenseList}>{recentExpenses.map((expense) => <article className={styles.expenseRow} key={expense.id}><div><strong>{expense.description}</strong><span>{expense.kind} · {expense.source}</span></div><div><strong>{money(expense.amount)}</strong><span>{formatDate(expense.date)}</span></div></article>)}</div>}</aside></div>
    <section className={styles.taskSectionWide}><div className={styles.sectionHeader}><div><h2>Revenue by task</h2><p>Read-only revenue observed from each Wallet service.</p></div></div>{visibleTasks.length === 0 ? <p className={styles.empty}>No Wallet revenue recorded in this period.</p> : <div className={styles.taskTable}>{visibleTasks.map((task) => <article className={styles.taskRow} key={task.taskId}><div><strong>{task.taskTitle}</strong><span>{formatDate(task.taskDate)} · {task.services.length} service{task.services.length === 1 ? "" : "s"}</span></div><strong>{money(task.revenue)}</strong></article>)}</div>}</section>
  </main>;
}
