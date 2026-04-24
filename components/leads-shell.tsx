"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Filter, Mail, Phone, Plus, Trash2 } from "lucide-react";
import {
  createLead,
  createLeadInstallment,
  createLeadInvoice,
  createLeadLog,
  deleteLeadInstallment,
  deleteLeadInvoice,
  deleteLead,
  deleteLeadLog,
  getLeadCompanies,
  getLeadFiles,
  getLeadInvoices,
  getLeadLogs,
  getLeads,
  getTaskBoard,
  saveTaskBoard,
  updateLeadInstallment,
  updateLeadInvoice,
  updateLeadLog,
  updateLead,
  type LeadInstallmentRecord,
  type LeadInvoiceRecord,
  type LeadCompanyRecord,
  type LeadFileRecord,
  type LeadLogRecord,
  type LeadRecord,
  type TaskBoardLane,
  type UpdateLeadInput,
} from "../lib/crm-api";
import { LeadResources } from "./lead-resources";
import { LeadWalletPanel } from "./lead-wallet-panel";
import { AddressAutocomplete } from "./address-autocomplete";
import { compressImageFile } from "../lib/image-compression";
import boardStyles from "./board-shell.module.css";
import styles from "./leads-shell.module.css";
import crmStyles from "./crm-shell.module.css";

type TaskStatus = "in_progress" | "done";
type WalletDraftItem = {
  id: string;
  description: string;
  cost: string;
  revenue: string;
};

const defaultWalletItems: WalletDraftItem[] = [
  { id: "wallet-primary", description: "", cost: "", revenue: "" },
  {
    id: "wallet-office-expenses",
    description: "Office expenses (printer and ink)",
    cost: "12",
    revenue: "",
  },
];

const emptyEditor: UpdateLeadInput = {
  firstName: "",
  middleName: "",
  lastName: "",
  leadPhotoDataUrl: "",
  dateOfBirth: "",
  taxId: "",
  gender: "Male",
  phoneNumber: "",
  email: "",
  address: "",
  source: "lead",
  serviceInterest: "Tax preparation",
  preferredLanguage: "English",
  notes: "",
};

const leadCategoryOptions = ["client", "recovery", "lead", "Proposal rejected", "Disqualified"];

function fullName(lead: LeadRecord) {
  return [lead.firstName, lead.middleName, lead.lastName].filter(Boolean).join(" ");
}

function initials(lead: LeadRecord) {
  const first = lead.firstName?.slice(0, 1) ?? "";
  const last = lead.lastName?.slice(0, 1) ?? "";
  return `${first}${last}` || "L";
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function formatPhoneNumber(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return value ?? "";
}

function parseMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function toWalletDraftItems(
  items?: Array<{ id: string; description: string; cost: number; revenue: number }>
) {
  if (!items || items.length === 0) {
    return defaultWalletItems.map((item) => ({ ...item }));
  }

  return items.map((item) => ({
    id: item.id,
    description: item.description,
    cost: item.cost ? String(item.cost) : "",
    revenue: item.revenue ? String(item.revenue) : "",
  }));
}

function toWalletItems(items: WalletDraftItem[], fallbackTitle: string) {
  return items
    .map((item, index) => ({
      id: item.id || `wallet-${index + 1}`,
      description: item.description.trim() || (index === 0 ? fallbackTitle : ""),
      cost: parseMoney(item.cost),
      revenue: parseMoney(item.revenue),
    }))
    .filter((item) => item.description || item.cost > 0 || item.revenue > 0);
}

function getWalletTotals(items: WalletDraftItem[]) {
  const totals = items.reduce(
    (current, item) => ({
      cost: current.cost + parseMoney(item.cost),
      revenue: current.revenue + parseMoney(item.revenue),
    }),
    { cost: 0, revenue: 0 }
  );
  const margin = totals.revenue - totals.cost;

  return {
    ...totals,
    margin,
    marginPercent: totals.revenue > 0 ? (margin / totals.revenue) * 100 : 0,
  };
}

function formatTagLabel(value?: string | null) {
  if (!value?.trim()) {
    return "Lead";
  }

  return value;
}

export function LeadsShell() {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<LeadRecord | null>(null);
  const [editorForm, setEditorForm] = useState<UpdateLeadInput>(emptyEditor);
  const [editorCompanies, setEditorCompanies] = useState<LeadCompanyRecord[]>([]);
  const [editorFiles, setEditorFiles] = useState<Array<LeadFileRecord & { fileDataBase64?: string }>>([]);
  const [editorLogs, setEditorLogs] = useState<LeadLogRecord[]>([]);
  const [editorInvoices, setEditorInvoices] = useState<LeadInvoiceRecord[]>([]);
  const [collapsedLogs, setCollapsedLogs] = useState<Record<string, boolean>>({});
  const [expandedLeadTaskId, setExpandedLeadTaskId] = useState<string | null>(null);
  const [leadTaskDrafts, setLeadTaskDrafts] = useState<
    Record<string, { notes: string; status: TaskStatus; walletItems: WalletDraftItem[] }>
  >({});
  const [taskBoard, setTaskBoard] = useState<TaskBoardLane[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [nameSearch, setNameSearch] = useState("");
  const [phoneSearch, setPhoneSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [photoFeedback, setPhotoFeedback] = useState<string | null>(null);
  const [leadLogMessage, setLeadLogMessage] = useState<string | null>(null);
  const [leadWalletMessage, setLeadWalletMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLeads() {
      setIsLoading(true);
      setMessage(null);

      try {
        const response = await getLeads();

        if (isMounted) {
          setLeads(response.leads);
        }
      } catch (error) {
        console.warn("[LeadsShell] failed to load leads:", error);

        if (isMounted) {
          setMessage("We could not load leads right now.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadLeads();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadTaskBoard() {
      try {
        const response = await getTaskBoard();

        if (isMounted) {
          setTaskBoard(response.lanes);
        }
      } catch (error) {
        console.warn("[LeadsShell] failed to load task board:", error);
      }
    }

    void loadTaskBoard();

    return () => {
      isMounted = false;
    };
  }, []);

  const tags = useMemo(() => {
    const values = new Set(leads.map((lead) => formatTagLabel(lead.source)));
    return ["all", ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [leads]);

  const tagSummary = useMemo(() => {
    const counts = new Map<string, number>();

    for (const lead of leads) {
      const key = formatTagLabel(lead.source);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const normalizedName = normalize(nameSearch);
    const normalizedPhone = normalizePhone(phoneSearch);

    return leads.filter((lead) => {
      const matchesName = !normalizedName || normalize(fullName(lead)).includes(normalizedName);
      const matchesPhone = !normalizedPhone || normalizePhone(lead.phoneNumber).includes(normalizedPhone);
      const matchesTag = tagFilter === "all" || formatTagLabel(lead.source) === tagFilter;

      return matchesName && matchesPhone && matchesTag;
    });
  }, [leads, nameSearch, phoneSearch, tagFilter]);

  async function openLeadEditor(lead: LeadRecord) {
    setSelectedLead(lead);
    setIsLeadModalOpen(true);
    setCopyFeedback(null);
    setPhotoFeedback(null);
    setLeadLogMessage(null);
    setLeadWalletMessage(null);
    setExpandedLeadTaskId(null);
    setLeadTaskDrafts({});
    setEditorForm({
      firstName: lead.firstName ?? "",
      middleName: lead.middleName ?? "",
      lastName: lead.lastName ?? "",
      leadPhotoDataUrl: lead.leadPhotoDataUrl ?? "",
      dateOfBirth: lead.dateOfBirth ? String(lead.dateOfBirth).slice(0, 10) : "",
      taxId: lead.taxId ?? "",
      gender: lead.gender ?? "Male",
      phoneNumber: formatPhoneNumber(lead.phoneNumber),
      email: lead.email ?? "",
      address: lead.address ?? "",
      source: leadCategoryOptions.includes(lead.source ?? "") ? lead.source ?? "lead" : "lead",
      serviceInterest: lead.serviceInterest ?? "Tax preparation",
      preferredLanguage: lead.preferredLanguage ?? "English",
      notes: lead.notes ?? "",
    });

    try {
      const [companiesResponse, filesResponse, logsResponse, invoicesResponse] = await Promise.all([
        getLeadCompanies(lead.id),
        getLeadFiles(lead.id),
        getLeadLogs(lead.id),
        getLeadInvoices(lead.id),
      ]);

      setEditorCompanies(companiesResponse.companies);
      setEditorFiles(filesResponse.files);
      setEditorLogs(logsResponse.logs);
      setEditorInvoices(invoicesResponse.invoices);
    } catch (error) {
      console.warn("[LeadsShell] failed to load lead resources:", error);
      setEditorCompanies([]);
      setEditorFiles([]);
      setEditorLogs([]);
      setEditorInvoices([]);
    }
  }

  function openNewLeadModal() {
    setSelectedLead(null);
    setIsLeadModalOpen(true);
    setCopyFeedback(null);
    setPhotoFeedback(null);
    setLeadLogMessage(null);
    setLeadWalletMessage(null);
    setExpandedLeadTaskId(null);
    setLeadTaskDrafts({});
    setEditorForm(emptyEditor);
    setEditorCompanies([]);
    setEditorFiles([]);
    setEditorLogs([]);
    setEditorInvoices([]);
  }

  function closeLeadModal() {
    setSelectedLead(null);
    setIsLeadModalOpen(false);
    setCopyFeedback(null);
    setPhotoFeedback(null);
    setLeadLogMessage(null);
    setLeadWalletMessage(null);
    setExpandedLeadTaskId(null);
    setLeadTaskDrafts({});
    setEditorInvoices([]);
  }

  function formatTaxId(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    return [digits.slice(0, 3), digits.slice(3, 5), digits.slice(5, 9)].filter(Boolean).join("-");
  }

  async function copyTaxId() {
    if (!editorForm.taxId) {
      setCopyFeedback("Add a Tax ID before copying.");
      return;
    }

    try {
      await navigator.clipboard.writeText(editorForm.taxId);
      setCopyFeedback("Tax ID copied.");
    } catch (error) {
      console.warn("[LeadsShell] failed to copy tax id:", error);
      setCopyFeedback("We could not copy the Tax ID.");
    }
  }

  async function copyLeadValue(value: string | null | undefined, label: string) {
    if (!value?.trim()) {
      setCopyFeedback(`Add ${label} before copying.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(value.trim());
      setCopyFeedback(`${label} copied.`);
    } catch (error) {
      console.warn("[LeadsShell] failed to copy lead value:", error);
      setCopyFeedback(`We could not copy ${label}.`);
    }
  }

  async function handleLeadPhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setPhotoFeedback("Use a JPG or PNG image.");
      return;
    }

    try {
      setPhotoFeedback("Optimizing photo...");
      const compressed = await compressImageFile(file, {
        maxBytes: 300_000,
        maxDimension: 900,
        initialQuality: 0.82,
        minQuality: 0.5,
      });

      setEditorForm((current) => ({ ...current, leadPhotoDataUrl: compressed.dataUrl }));
      setPhotoFeedback(`Lead photo ready (${Math.ceil(compressed.size / 1024)} KB).`);
      event.target.value = "";
    } catch (error) {
      console.warn("[LeadsShell] failed to compress lead photo:", error);
      setPhotoFeedback("We could not compress this photo under 300 KB.");
      event.target.value = "";
    }
  }

  async function saveLeadUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const payload = {
        ...editorForm,
        firstName: editorForm.firstName.trim(),
        middleName: editorForm.middleName?.trim(),
        lastName: editorForm.lastName.trim(),
        phoneNumber: editorForm.phoneNumber.trim(),
        email: editorForm.email?.trim(),
        address: editorForm.address?.trim(),
      };

      if (selectedLead) {
        const response = await updateLead(selectedLead.id, payload);
        setLeads((current) => current.map((lead) => (lead.id === selectedLead.id ? response.lead : lead)));
      } else {
        const response = await createLead(payload);
        setLeads((current) => [response.lead, ...current]);
      }

      closeLeadModal();
    } catch (error) {
      console.warn("[LeadsShell] failed to update lead:", error);
      setMessage(selectedLead ? "We could not update this lead right now." : "We could not create this lead right now.");
    }
  }

  function getLeadTaskEntries(leadId: string) {
    return taskBoard.flatMap((lane) =>
      lane.tasks
        .filter((task) => task.leadId === leadId)
        .map((task) => ({
          laneId: lane.id,
          laneTitle: lane.title,
          task,
        }))
    );
  }

  function toggleLeadTaskEditor(task: TaskBoardLane["tasks"][number]) {
    setExpandedLeadTaskId((current) => (current === task.id ? null : task.id));
    setLeadTaskDrafts((current) => ({
      ...current,
      [task.id]: current[task.id] ?? {
        notes: task.notes,
        status: task.status === "done" ? "done" : "in_progress",
        walletItems: toWalletDraftItems(task.walletItems),
      },
    }));
  }

  function updateLeadTaskDraft(
    taskId: string,
    patch: Partial<{ notes: string; status: TaskStatus; walletItems: WalletDraftItem[] }>
  ) {
    setLeadTaskDrafts((current) => ({
      ...current,
      [taskId]: {
        ...(current[taskId] ?? { notes: "", status: "in_progress", walletItems: defaultWalletItems.map((item) => ({ ...item })) }),
        ...patch,
      },
    }));
  }

  function updateLeadTaskWalletItem(
    taskId: string,
    itemId: string,
    field: keyof Omit<WalletDraftItem, "id">,
    value: string
  ) {
    setLeadTaskDrafts((current) => {
      const draft = current[taskId] ?? {
        notes: "",
        status: "in_progress" as TaskStatus,
        walletItems: defaultWalletItems.map((item) => ({ ...item })),
      };

      return {
        ...current,
        [taskId]: {
          ...draft,
          walletItems: draft.walletItems.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
        },
      };
    });
  }

  function addLeadTaskWalletItem(taskId: string) {
    setLeadTaskDrafts((current) => {
      const draft = current[taskId] ?? {
        notes: "",
        status: "in_progress" as TaskStatus,
        walletItems: defaultWalletItems.map((item) => ({ ...item })),
      };

      return {
        ...current,
        [taskId]: {
          ...draft,
          walletItems: [
            ...draft.walletItems,
            { id: `wallet-${crypto.randomUUID()}`, description: "", cost: "", revenue: "" },
          ],
        },
      };
    });
  }

  function removeLeadTaskWalletItem(taskId: string, itemId: string) {
    setLeadTaskDrafts((current) => {
      const draft = current[taskId] ?? {
        notes: "",
        status: "in_progress" as TaskStatus,
        walletItems: defaultWalletItems.map((item) => ({ ...item })),
      };
      const nextWalletItems = draft.walletItems.filter((item) => item.id !== itemId);

      return {
        ...current,
        [taskId]: {
          ...draft,
          walletItems: nextWalletItems.length > 0 ? nextWalletItems : [{ id: "wallet-primary", description: "", cost: "", revenue: "" }],
        },
      };
    });
  }

  async function saveLeadTaskUpdate(laneId: string, taskId: string) {
    const draft = leadTaskDrafts[taskId];

    if (!draft) {
      return;
    }

    const nextTaskBoard = taskBoard.map((lane) =>
      lane.id === laneId
        ? {
            ...lane,
            tasks: lane.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    notes: draft.notes.trim(),
                    status: draft.status,
                    walletItems: toWalletItems(draft.walletItems, task.title),
                  }
                : task
            ),
          }
        : lane
    );

    setTaskBoard(nextTaskBoard);

    try {
      await saveTaskBoard(nextTaskBoard);
      setExpandedLeadTaskId(null);
    } catch (error) {
      console.warn("[LeadsShell] failed to save task board:", error);
      setMessage("We could not save this task right now.");
    }
  }

  async function addLeadLog() {
    if (!selectedLead) {
      return;
    }

    setLeadLogMessage(null);

    try {
      const response = await createLeadLog(selectedLead.id, {
        title: "New log",
        description: "",
      });

      setEditorLogs((current) => [response.log, ...current]);
      setCollapsedLogs((current) => ({ ...current, [response.log.id]: true }));
    } catch (error) {
      console.warn("[LeadsShell] failed to create lead log:", error);
      setLeadLogMessage("We could not create this log yet.");
    }
  }

  async function updateLeadLogDraft(logId: string, patch: Partial<LeadLogRecord>) {
    setLeadLogMessage(null);
    const nextLogs = editorLogs.map((log) => (log.id === logId ? { ...log, ...patch } : log));
    setEditorLogs(nextLogs);

    if (!selectedLead) {
      return;
    }

    const nextLog = nextLogs.find((log) => log.id === logId);

    if (!nextLog) {
      return;
    }

    try {
      const response = await updateLeadLog(selectedLead.id, logId, {
        title: nextLog.title.trim() || "New log",
        description: nextLog.description?.trim() ?? "",
      });
      setEditorLogs((current) => current.map((log) => (log.id === logId ? response.log : log)));
    } catch (error) {
      console.warn("[LeadsShell] failed to update lead log:", error);
      setLeadLogMessage("We could not save this log yet.");
    }
  }

  async function removeLeadLog(logId: string) {
    if (!selectedLead) {
      return;
    }

    setLeadLogMessage(null);
    setEditorLogs((current) => current.filter((log) => log.id !== logId));

    try {
      await deleteLeadLog(selectedLead.id, logId);
    } catch (error) {
      console.warn("[LeadsShell] failed to delete lead log:", error);
      setLeadLogMessage("We could not delete this log yet.");
    }
  }

  async function addLeadInvoice() {
    if (!selectedLead) {
      return;
    }

    setLeadWalletMessage(null);
    const linkedTasks = getLeadTaskEntries(selectedLead.id)
      .filter(({ task }) => task.status !== "done")
      .map(({ task }) => task.id);
    const suggestedAmount = getLeadTaskEntries(selectedLead.id)
      .filter(({ task }) => task.status !== "done")
      .reduce((sum, { task }) => {
        const revenue = (task.walletItems ?? []).reduce((walletSum, item) => walletSum + parseMoney(item.revenue), 0);
        return sum + revenue;
      }, 0);

    try {
      const response = await createLeadInvoice(selectedLead.id, {
        title: `${fullName(selectedLead) || "Lead"} invoice ${editorInvoices.length + 1}`,
        amount: suggestedAmount,
        status: "pending",
        issuedAt: new Date().toISOString().slice(0, 10),
        dueDate: "",
        notes: "",
        sourceTaskIds: linkedTasks,
      });
      setEditorInvoices((current) => [response.invoice, ...current]);
    } catch (error) {
      console.warn("[LeadsShell] failed to create invoice:", error);
      setLeadWalletMessage(error instanceof Error ? error.message : "We could not create this invoice yet.");
    }
  }

  async function updateInvoiceDraft(invoiceId: string, patch: Partial<LeadInvoiceRecord>) {
    if (!selectedLead) {
      return;
    }

    setLeadWalletMessage(null);
    const nextInvoices = editorInvoices.map((invoice) => (invoice.id === invoiceId ? { ...invoice, ...patch } : invoice));
    setEditorInvoices(nextInvoices);

    const nextInvoice = nextInvoices.find((invoice) => invoice.id === invoiceId);

    if (!nextInvoice) {
      return;
    }

    try {
      const response = await updateLeadInvoice(selectedLead.id, invoiceId, {
        title: nextInvoice.title.trim() || "Invoice",
        amount: parseMoney(nextInvoice.amount),
        status: nextInvoice.status,
        dueDate: nextInvoice.dueDate ?? "",
        issuedAt: nextInvoice.issuedAt ?? "",
        notes: nextInvoice.notes ?? "",
        sourceTaskIds: nextInvoice.sourceTaskIds ?? [],
      });
      setEditorInvoices((current) =>
        current.map((invoice) =>
          invoice.id === invoiceId ? { ...response.invoice, installments: invoice.installments } : invoice
        )
      );
    } catch (error) {
      console.warn("[LeadsShell] failed to update invoice:", error);
      setLeadWalletMessage(error instanceof Error ? error.message : "We could not save this invoice yet.");
    }
  }

  async function removeInvoice(invoiceId: string) {
    if (!selectedLead) {
      return;
    }

    setLeadWalletMessage(null);
    setEditorInvoices((current) => current.filter((invoice) => invoice.id !== invoiceId));

    try {
      await deleteLeadInvoice(selectedLead.id, invoiceId);
    } catch (error) {
      console.warn("[LeadsShell] failed to delete invoice:", error);
      setLeadWalletMessage(error instanceof Error ? error.message : "We could not delete this invoice yet.");
    }
  }

  async function addInstallment(invoiceId: string) {
    if (!selectedLead) {
      return;
    }

    setLeadWalletMessage(null);
    const invoice = editorInvoices.find((item) => item.id === invoiceId);

    if (!invoice) {
      return;
    }

    try {
      const response = await createLeadInstallment(selectedLead.id, invoiceId, {
        amount: parseMoney(invoice.amount),
        dueDate: invoice.dueDate ?? "",
        status: "pending",
      });
      setEditorInvoices((current) =>
        current.map((item) =>
          item.id === invoiceId ? { ...item, installments: [...item.installments, response.installment] } : item
        )
      );
    } catch (error) {
      console.warn("[LeadsShell] failed to create installment:", error);
      setLeadWalletMessage(error instanceof Error ? error.message : "We could not create this installment yet.");
    }
  }

  async function updateInstallmentDraft(
    invoiceId: string,
    installmentId: string,
    patch: Partial<LeadInstallmentRecord>
  ) {
    if (!selectedLead) {
      return;
    }

    setLeadWalletMessage(null);
    const nextInvoices = editorInvoices.map((invoice) =>
      invoice.id === invoiceId
        ? {
            ...invoice,
            installments: invoice.installments.map((installment) =>
              installment.id === installmentId ? { ...installment, ...patch } : installment
            ),
          }
        : invoice
    );
    setEditorInvoices(nextInvoices);

    const nextInvoice = nextInvoices.find((invoice) => invoice.id === invoiceId);
    const nextInstallment = nextInvoice?.installments.find((installment) => installment.id === installmentId);

    if (!nextInstallment) {
      return;
    }

    try {
      const response = await updateLeadInstallment(selectedLead.id, invoiceId, installmentId, {
        amount: parseMoney(nextInstallment.amount),
        dueDate: nextInstallment.dueDate ?? "",
        status: nextInstallment.status,
        paidAt: nextInstallment.paidAt ?? "",
        paymentMethod: nextInstallment.paymentMethod ?? "",
        notes: nextInstallment.notes ?? "",
      });
      setEditorInvoices((current) =>
        current.map((invoice) =>
          invoice.id === invoiceId
            ? {
                ...invoice,
                installments: invoice.installments.map((installment) =>
                  installment.id === installmentId ? response.installment : installment
                ),
              }
            : invoice
        )
      );
    } catch (error) {
      console.warn("[LeadsShell] failed to update installment:", error);
      setLeadWalletMessage(error instanceof Error ? error.message : "We could not save this installment yet.");
    }
  }

  async function removeInstallment(invoiceId: string, installmentId: string) {
    if (!selectedLead) {
      return;
    }

    setLeadWalletMessage(null);
    setEditorInvoices((current) =>
      current.map((invoice) =>
        invoice.id === invoiceId
          ? {
              ...invoice,
              installments: invoice.installments.filter((installment) => installment.id !== installmentId),
            }
          : invoice
      )
    );

    try {
      await deleteLeadInstallment(selectedLead.id, invoiceId, installmentId);
    } catch (error) {
      console.warn("[LeadsShell] failed to delete installment:", error);
      setLeadWalletMessage(error instanceof Error ? error.message : "We could not delete this installment yet.");
    }
  }

  async function confirmDeleteLead() {
    if (!leadToDelete) {
      return;
    }

    try {
      await deleteLead(leadToDelete.id);
      setLeads((current) => current.filter((lead) => lead.id !== leadToDelete.id));
      setLeadToDelete(null);
    } catch (error) {
      console.warn("[LeadsShell] failed to delete lead:", error);
      setMessage("We could not delete this lead right now.");
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Lead directory</p>
          <h1>Leads</h1>
          <p>Organize sua base por tag, encontre contatos rápido e abra o profile sem sair da listagem.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.filterToggle} onClick={() => setIsFilterOpen((current) => !current)}>
            <Filter size={16} strokeWidth={2} aria-hidden="true" />
            Filters
          </button>
          <Link href="/dashboard">Back to dashboard</Link>
          <button type="button" className={styles.primaryLinkButton} onClick={openNewLeadModal}>
            New lead
          </button>
        </div>
      </header>

      <section className={styles.summaryGrid}>
        {tagSummary.map((item, index) => (
          <button
            key={item.tag}
            type="button"
            className={`${styles.summaryCard} ${tagFilter === item.tag ? styles.summaryCardActive : ""}`}
            onClick={() => setTagFilter((current) => (current === item.tag ? "all" : item.tag))}
          >
            <span
              className={styles.summaryDot}
              style={{ ["--summary-accent" as string]: `var(--tag-accent-${(index % 5) + 1})` }}
            />
            <div>
              <strong>{item.tag}</strong>
              <small>{item.count} leads</small>
            </div>
          </button>
        ))}
      </section>

      {isFilterOpen ? (
        <section className={styles.filterCard}>
          <label>
            <span>Name search</span>
            <input
              value={nameSearch}
              onBlur={() => setNameSearch(nameSearch.trim())}
              onChange={(event) => setNameSearch(event.target.value)}
              placeholder="Search by lead name"
            />
          </label>

          <label>
            <span>Phone search</span>
            <input
              value={phoneSearch}
              onBlur={() => setPhoneSearch(phoneSearch.trim())}
              onChange={(event) => setPhoneSearch(event.target.value)}
              placeholder="Search by phone"
            />
          </label>

          <label>
            <span>Tag</span>
            <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag === "all" ? "All tags" : tag}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.filterActions}>
            <button
              type="button"
              className={styles.clearFiltersButton}
              onClick={() => {
                setNameSearch("");
                setPhoneSearch("");
                setTagFilter("all");
              }}
            >
              Clear filters
            </button>
          </div>
        </section>
      ) : null}

      <section className={styles.directoryHeader}>
        <h2>Directory ({isLoading ? "..." : filteredLeads.length})</h2>
        <div className={styles.directoryMeta}>
          <span className={styles.activeFilterPill}>{tagFilter === "all" ? "All tags" : tagFilter}</span>
          {message ? <p>{message}</p> : null}
        </div>
      </section>

      <section className={styles.cardsGrid}>
        {filteredLeads.map((lead) => (
          <article key={lead.id} className={styles.leadCard}>
            <div className={styles.leadCardHeader}>
              <button type="button" className={styles.recordCell} onClick={() => void openLeadEditor(lead)}>
                <div className={styles.avatar}>
                  {lead.leadPhotoDataUrl ? (
                    <img src={lead.leadPhotoDataUrl} alt="" />
                  ) : (
                    <span>{initials(lead)}</span>
                  )}
                </div>
                <div className={styles.leadIdentity}>
                  <strong>{fullName(lead)}</strong>
                  <small>{lead.updatedAt ? new Date(lead.updatedAt).toLocaleDateString("en-US") : "Lead record"}</small>
                </div>
              </button>
              <button
                type="button"
                className={styles.deleteButton}
                aria-label={`Delete ${fullName(lead)}`}
                onClick={() => setLeadToDelete(lead)}
              >
                <Trash2 size={17} />
              </button>
            </div>

            <button type="button" className={styles.leadCardBody} onClick={() => void openLeadEditor(lead)}>
              <div className={styles.contactRow}>
                <Phone size={15} strokeWidth={2} aria-hidden="true" />
                <span>{formatPhoneNumber(lead.phoneNumber) || "No phone yet"}</span>
              </div>
              <div className={styles.contactRow}>
                <Mail size={15} strokeWidth={2} aria-hidden="true" />
                <span>{lead.email?.trim() || "No email yet"}</span>
              </div>
              <div className={styles.cardFooter}>
                <span className={styles.tagPill}>{formatTagLabel(lead.source)}</span>
              </div>
            </button>
          </article>
        ))}

        {!isLoading && filteredLeads.length === 0 ? (
          <div className={styles.emptyState}>No leads match this search yet.</div>
        ) : null}
      </section>

      {isLeadModalOpen ? (
        <div className={crmStyles.modalOverlay} onClick={closeLeadModal}>
          <aside className={crmStyles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={crmStyles.modalHeader}>
              <div>
                <p className={crmStyles.modalEyebrow}>Lead profile</p>
                <h2>{selectedLead ? "Edit lead" : "New lead"}</h2>
              </div>
              <button type="button" className={crmStyles.modalCloseButton} onClick={closeLeadModal}>
                Close
              </button>
            </div>

            <form className={crmStyles.modalForm} onSubmit={saveLeadUpdate}>
              <section className={crmStyles.intakeSection}>
                <label className={crmStyles.avatarPreview}>
                  <input type="file" accept="image/jpeg,image/png" onChange={handleLeadPhotoChange} />
                  {editorForm.leadPhotoDataUrl ? (
                    <img src={editorForm.leadPhotoDataUrl} alt="Lead preview" />
                  ) : (
                    <span>{editorForm.firstName.slice(0, 1) || "L"}</span>
                  )}
                  <small>{photoFeedback ?? "Click to add photo"} JPG/PNG, max 300 KB.</small>
                </label>

                <div className={crmStyles.intakeGrid}>
                  <label className={crmStyles.field}>
                    <span>First name</span>
                    <div className={crmStyles.copyInputWrap}>
                      <input
                        value={editorForm.firstName}
                        onBlur={() => setEditorForm((current) => ({ ...current, firstName: current.firstName.trim() }))}
                        onChange={(event) => setEditorForm((current) => ({ ...current, firstName: event.target.value }))}
                        placeholder="First name"
                      />
                      <button
                        type="button"
                        onClick={() => void copyLeadValue(editorForm.firstName, "First name")}
                        aria-label="Copy first name"
                      >
                        <Copy size={17} />
                      </button>
                    </div>
                  </label>

                  <label className={crmStyles.field}>
                    <span>Middle name</span>
                    <div className={crmStyles.copyInputWrap}>
                      <input
                        value={editorForm.middleName}
                        onBlur={() => setEditorForm((current) => ({ ...current, middleName: current.middleName?.trim() }))}
                        onChange={(event) => setEditorForm((current) => ({ ...current, middleName: event.target.value }))}
                        placeholder="Middle name"
                      />
                      <button
                        type="button"
                        onClick={() => void copyLeadValue(editorForm.middleName, "Middle name")}
                        aria-label="Copy middle name"
                      >
                        <Copy size={17} />
                      </button>
                    </div>
                  </label>

                  <label className={crmStyles.field}>
                    <span>Last name</span>
                    <div className={crmStyles.copyInputWrap}>
                      <input
                        value={editorForm.lastName}
                        onBlur={() => setEditorForm((current) => ({ ...current, lastName: current.lastName.trim() }))}
                        onChange={(event) => setEditorForm((current) => ({ ...current, lastName: event.target.value }))}
                        placeholder="Last name"
                      />
                      <button
                        type="button"
                        onClick={() => void copyLeadValue(editorForm.lastName, "Last name")}
                        aria-label="Copy last name"
                      >
                        <Copy size={17} />
                      </button>
                    </div>
                  </label>

                  <label className={crmStyles.field}>
                    <span>Date of birth</span>
                    <input
                      type="date"
                      value={editorForm.dateOfBirth}
                      onChange={(event) => setEditorForm((current) => ({ ...current, dateOfBirth: event.target.value }))}
                    />
                  </label>

                  <div className={crmStyles.field}>
                    <span>Tax ID</span>
                    <div className={crmStyles.copyInputWrap}>
                      <input
                        inputMode="numeric"
                        maxLength={11}
                        value={editorForm.taxId}
                        onChange={(event) =>
                          setEditorForm((current) => ({ ...current, taxId: formatTaxId(event.target.value) }))
                        }
                        placeholder="xxx-xx-xxxx"
                      />
                      <button type="button" onClick={copyTaxId} aria-label="Copy Tax ID">
                        <Copy size={17} />
                      </button>
                    </div>
                    {copyFeedback ? <small className={crmStyles.copyFeedback}>{copyFeedback}</small> : null}
                  </div>

                  <label className={crmStyles.field}>
                    <span>Tag</span>
                    <select
                      value={editorForm.source}
                      onChange={(event) => setEditorForm((current) => ({ ...current, source: event.target.value }))}
                    >
                      {leadCategoryOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={crmStyles.fieldWide}>
                    <span>Gender</span>
                    <select
                      value={editorForm.gender}
                      onChange={(event) => setEditorForm((current) => ({ ...current, gender: event.target.value }))}
                    >
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                      <option>Prefer not to say</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className={crmStyles.intakeSectionStack}>
                <h3>Contact</h3>
                <div className={crmStyles.contactGrid}>
                  <label className={crmStyles.field}>
                    <span>Phone number</span>
                    <div className={crmStyles.copyInputWrap}>
                      <input
                        value={editorForm.phoneNumber}
                        onBlur={() =>
                          setEditorForm((current) => ({
                            ...current,
                            phoneNumber: formatPhoneNumber(current.phoneNumber.trim()),
                          }))
                        }
                        onChange={(event) =>
                          setEditorForm((current) => ({
                            ...current,
                            phoneNumber: formatPhoneNumber(event.target.value),
                          }))
                        }
                        placeholder="(000) 000-0000"
                      />
                      <button
                        type="button"
                        onClick={() => void copyLeadValue(editorForm.phoneNumber, "Phone number")}
                        aria-label="Copy phone number"
                      >
                        <Copy size={17} />
                      </button>
                    </div>
                  </label>

                  <label className={crmStyles.field}>
                    <span>Email</span>
                    <div className={crmStyles.copyInputWrap}>
                      <input
                        type="email"
                        value={editorForm.email}
                        onBlur={() => setEditorForm((current) => ({ ...current, email: current.email?.trim() }))}
                        onChange={(event) => setEditorForm((current) => ({ ...current, email: event.target.value }))}
                        placeholder="client@email.com"
                      />
                      <button
                        type="button"
                        onClick={() => void copyLeadValue(editorForm.email, "Email")}
                        aria-label="Copy email"
                      >
                        <Copy size={17} />
                      </button>
                    </div>
                  </label>

                  <label className={crmStyles.fieldFull}>
                    <span>Address</span>
                    <div className={crmStyles.copyInputWrap}>
                      <AddressAutocomplete
                        value={editorForm.address ?? ""}
                        onBlur={() => setEditorForm((current) => ({ ...current, address: current.address?.trim() }))}
                        onChange={(address) => setEditorForm((current) => ({ ...current, address }))}
                        placeholder="Address"
                      />
                      <button
                        type="button"
                        onClick={() => void copyLeadValue(editorForm.address, "Address")}
                        aria-label="Copy address"
                      >
                        <Copy size={17} />
                      </button>
                    </div>
                  </label>
                </div>
              </section>

              {selectedLead ? (
              <section className={crmStyles.intakeSectionStack}>
                <div className={crmStyles.sectionTitleRow}>
                  <h3>Logs</h3>
                  <button type="button" onClick={addLeadLog} aria-label="Add lead log">
                    <Plus size={19} />
                  </button>
                </div>
                {leadLogMessage ? <p className={crmStyles.resourceMessage}>{leadLogMessage}</p> : null}
                <div className={boardStyles.leadLogStack}>
                  {editorLogs.map((log) => {
                    const isCollapsed = collapsedLogs[log.id] ?? true;

                    return (
                      <article key={log.id} className={boardStyles.leadLogCard}>
                        <div className={boardStyles.leadLogHeader}>
                          <button
                            type="button"
                            onClick={() => setCollapsedLogs((current) => ({ ...current, [log.id]: !isCollapsed }))}
                            aria-label={isCollapsed ? "Open log details" : "Close log details"}
                          >
                            {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                          </button>
                          <input
                            value={log.title}
                            onChange={(event) =>
                              setEditorLogs((current) =>
                                current.map((item) => (item.id === log.id ? { ...item, title: event.target.value } : item))
                              )
                            }
                            onBlur={(event) => void updateLeadLogDraft(log.id, { title: event.target.value })}
                            placeholder="Log title"
                          />
                          <button type="button" onClick={() => void removeLeadLog(log.id)} aria-label="Delete log">
                            <Trash2 size={18} />
                          </button>
                        </div>

                        {!isCollapsed ? (
                          <div className={boardStyles.miniRichEditor}>
                            <div aria-hidden="true">
                              <button type="button">Sans Serif</button>
                              <button type="button">Normal</button>
                              <button type="button">B</button>
                              <button type="button">I</button>
                              <button type="button">U</button>
                            </div>
                            <textarea
                              value={log.description ?? ""}
                              onChange={(event) =>
                                setEditorLogs((current) =>
                                  current.map((item) =>
                                    item.id === log.id ? { ...item, description: event.target.value } : item
                                  )
                                )
                              }
                              onBlur={(event) => void updateLeadLogDraft(log.id, { description: event.target.value })}
                              placeholder="Type log details..."
                            />
                          </div>
                        ) : null}
                      </article>
                    );
                  })}

                  {editorLogs.length === 0 ? (
                    <p className={boardStyles.leadEmptyState}>No logs for this lead yet.</p>
                  ) : null}
                </div>
              </section>
              ) : null}

              {selectedLead ? (
              <LeadResources
                leadId={selectedLead.id}
                companies={editorCompanies}
                files={editorFiles}
                onCompaniesChange={setEditorCompanies}
                onFilesChange={setEditorFiles}
                sections={["files"]}
              />
              ) : null}

              {selectedLead ? (
              <section className={crmStyles.intakeSectionStack}>
                <h3>Task log</h3>
                <div className={boardStyles.leadTaskLogStack}>
                  {getLeadTaskEntries(selectedLead.id).map(({ laneId, laneTitle, task }) => {
                    const draft = leadTaskDrafts[task.id] ?? {
                      notes: task.notes,
                      status: task.status === "done" ? "done" : "in_progress",
                      walletItems: toWalletDraftItems(task.walletItems),
                    };
                    const isExpanded = expandedLeadTaskId === task.id;

                    return (
                      <article key={task.id} className={boardStyles.leadTaskLogCard}>
                        <button type="button" onClick={() => toggleLeadTaskEditor(task)}>
                          <div>
                            <strong>{task.title}</strong>
                            <span>{laneTitle}</span>
                          </div>
                          <small>{task.status === "done" ? "Done" : "In progress"}</small>
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>

                        {isExpanded ? (
                          <div className={boardStyles.leadTaskEditor}>
                            <label>
                              <span>Status</span>
                              <select
                                value={draft.status}
                                onChange={(event) =>
                                  updateLeadTaskDraft(task.id, {
                                    status: event.target.value === "done" ? "done" : "in_progress",
                                  })
                                }
                              >
                                <option value="in_progress">In progress</option>
                                <option value="done">Done</option>
                              </select>
                            </label>
                            <label>
                              <span>Description</span>
                              <div className={boardStyles.miniRichEditor}>
                                <div aria-hidden="true">
                                  <button type="button">Sans Serif</button>
                                  <button type="button">Normal</button>
                                  <button type="button">B</button>
                                  <button type="button">I</button>
                                  <button type="button">U</button>
                                </div>
                                <textarea
                                  value={draft.notes}
                                  onChange={(event) => updateLeadTaskDraft(task.id, { notes: event.target.value })}
                                  placeholder="Task description"
                                />
                              </div>
                            </label>
                            <section className={boardStyles.walletPanel}>
                              <div className={boardStyles.walletHeader}>
                                <h3>Wallet</h3>
                                <button type="button" onClick={() => addLeadTaskWalletItem(task.id)}>
                                  + New
                                </button>
                              </div>

                              <div className={boardStyles.walletRows}>
                                {draft.walletItems.map((item, index) => (
                                  <div key={item.id} className={boardStyles.walletRow}>
                                    <input
                                      value={item.description || (index === 0 ? task.title : "")}
                                      onChange={(event) =>
                                        updateLeadTaskWalletItem(task.id, item.id, "description", event.target.value)
                                      }
                                      placeholder={index === 0 ? task.title || "Task name" : "Description"}
                                    />
                                    <input
                                      inputMode="decimal"
                                      value={item.cost}
                                      onChange={(event) =>
                                        updateLeadTaskWalletItem(task.id, item.id, "cost", event.target.value)
                                      }
                                      placeholder="Cost"
                                    />
                                    <input
                                      inputMode="decimal"
                                      value={item.revenue}
                                      onChange={(event) =>
                                        updateLeadTaskWalletItem(task.id, item.id, "revenue", event.target.value)
                                      }
                                      placeholder="Revenue"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeLeadTaskWalletItem(task.id, item.id)}
                                      aria-label="Remove wallet row"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                ))}
                              </div>

                              <div className={boardStyles.walletTotals}>
                                <div>
                                  <span>Total cost</span>
                                  <strong>{formatMoney(getWalletTotals(draft.walletItems).cost)}</strong>
                                </div>
                                <div>
                                  <span>Revenue</span>
                                  <strong>{formatMoney(getWalletTotals(draft.walletItems).revenue)}</strong>
                                </div>
                                <div>
                                  <span>Margin</span>
                                  <strong>{formatMoney(getWalletTotals(draft.walletItems).margin)}</strong>
                                </div>
                                <div>
                                  <span>Margin %</span>
                                  <strong>{getWalletTotals(draft.walletItems).marginPercent.toFixed(1)}%</strong>
                                </div>
                              </div>
                            </section>
                            <button type="button" onClick={() => void saveLeadTaskUpdate(laneId, task.id)}>
                              Save task
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}

                  {getLeadTaskEntries(selectedLead.id).length === 0 ? (
                    <p className={boardStyles.leadEmptyState}>No tasks attached to this lead yet.</p>
                  ) : null}
                </div>
              </section>
              ) : null}

              {selectedLead ? (
              <LeadResources
                leadId={selectedLead.id}
                companies={editorCompanies}
                files={editorFiles}
                onCompaniesChange={setEditorCompanies}
                onFilesChange={setEditorFiles}
                sections={["companies"]}
              />
              ) : null}

              {selectedLead ? (
                <LeadWalletPanel
                  leadName={fullName(selectedLead)}
                  tasks={getLeadTaskEntries(selectedLead.id).map(({ task }) => task)}
                  invoices={editorInvoices}
                  message={leadWalletMessage}
                  onAddInvoice={addLeadInvoice}
                  onUpdateInvoice={updateInvoiceDraft}
                  onDeleteInvoice={removeInvoice}
                  onAddInstallment={addInstallment}
                  onUpdateInstallment={updateInstallmentDraft}
                  onDeleteInstallment={removeInstallment}
                />
              ) : null}

              <div className={crmStyles.modalActions}>
                <button type="button" className={crmStyles.secondaryModalButton} onClick={closeLeadModal}>
                  Cancel
                </button>
                <button type="submit" className={crmStyles.primaryModalButton}>
                  {selectedLead ? "Save lead" : "Create lead"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}

      {leadToDelete ? (
        <div className={styles.modalOverlay} onClick={() => setLeadToDelete(null)}>
          <aside className={styles.confirmModal} onClick={(event) => event.stopPropagation()}>
            <p className={styles.eyebrow}>Confirm delete</p>
            <h2>Delete {fullName(leadToDelete)}?</h2>
            <p>This action removes the lead from the directory. We will reuse this confirmation pattern across the CRM.</p>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setLeadToDelete(null)}>
                Cancel
              </button>
              <button type="button" className={styles.dangerButton} onClick={confirmDeleteLead}>
                Delete lead
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
