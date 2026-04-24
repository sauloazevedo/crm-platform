"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Copy, GripVertical, MoreVertical, Palette, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import {
  createLeadInstallment,
  createLeadInvoice,
  createLeadLog,
  createLead as createLeadRequest,
  deleteLeadInstallment,
  deleteLeadInvoice,
  deleteLeadLog,
  getLeadCompanies,
  getLeadFiles,
  getLeadInvoices,
  getLeads,
  getLeadLogs,
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
  type UpdateLeadInput,
} from "../lib/crm-api";
import { AddressAutocomplete } from "./address-autocomplete";
import { LeadResources } from "./lead-resources";
import { LeadWalletPanel } from "./lead-wallet-panel";
import { compressImageFile } from "../lib/image-compression";
import styles from "./board-shell.module.css";
import crmStyles from "./crm-shell.module.css";

type TaskStatus = "in_progress" | "done";
type TaskStatusFilter = "all" | TaskStatus;

type WalletItem = {
  id: string;
  description: string;
  cost: number;
  revenue: number;
};

type WalletDraftItem = {
  id: string;
  description: string;
  cost: string;
  revenue: string;
};

type Task = {
  id: string;
  title: string;
  notes: string;
  leadId?: string | null;
  leadName?: string | null;
  leadSearch?: string;
  status: TaskStatus;
  hidden?: boolean;
  walletItems?: WalletItem[];
};

type Lane = {
  id: string;
  title: string;
  tasks: Task[];
};

type LaneColorSettings = {
  color: string;
  opacity: number;
};

type DraftTask = {
  title: string;
  titleWasSelected: boolean;
  notes: string;
  leadId: string;
  leadSearch: string;
  newLeadName: string;
  newLeadPhone: string;
  isCreatingLead: boolean;
  status: TaskStatus;
  walletItems: WalletDraftItem[];
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

const leadCategoryOptions = ["client", "recovery", "lead", "Proposal rejected", "Disqualified"];

const emptyTaskDraft: DraftTask = {
  title: "",
  titleWasSelected: false,
  notes: "",
  leadId: "",
  leadSearch: "",
  newLeadName: "",
  newLeadPhone: "",
  isCreatingLead: false,
  status: "in_progress",
  walletItems: defaultWalletItems,
};

const emptyLeadEditor: UpdateLeadInput = {
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

const legacyStarterLaneIds = new Set(["lane-new", "lane-docs", "lane-review"]);
const laneColorStorageKey = "smart-crm:lane-colors";
const defaultLaneColor: LaneColorSettings = {
  color: "#081526",
  opacity: 1,
};

function getInitialLaneColors() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const stored = window.localStorage.getItem(laneColorStorageKey);

    if (!stored) {
      return {};
    }

    return JSON.parse(stored) as Record<string, LaneColorSettings>;
  } catch (error) {
    console.warn("[BoardShell] failed to read initial lane colors:", error);
    return {};
  }
}

function reorder<T>(items: T[], startIndex: number, endIndex: number) {
  const copy = [...items];
  const [removed] = copy.splice(startIndex, 1);
  copy.splice(endIndex, 0, removed);
  return copy;
}

function hexToRgba(hexColor: string, opacity: number) {
  const normalized = hexColor.replace("#", "");

  if (normalized.length !== 6) {
    return `rgba(8, 21, 38, ${opacity})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function getFullName(lead: LeadRecord) {
  return [lead.firstName, lead.middleName, lead.lastName].filter(Boolean).join(" ");
}

function getLeadInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
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

function parseMoney(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function toWalletDraftItems(items?: WalletItem[]) {
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

function toWalletItems(items: WalletDraftItem[], fallbackTitle: string): WalletItem[] {
  return items
    .map((item, index) => ({
      id: item.id || `wallet-${index + 1}`,
      description: item.description.trim() || (index === 0 ? fallbackTitle : ""),
      cost: parseMoney(item.cost),
      revenue: parseMoney(item.revenue),
    }))
    .filter((item) => item.description || item.cost > 0 || item.revenue > 0);
}

function getWalletTotals(items: WalletDraftItem[] | WalletItem[]) {
  const totals = items.reduce(
    (current, item) => {
      const cost = typeof item.cost === "number" ? item.cost : parseMoney(item.cost);
      const revenue = typeof item.revenue === "number" ? item.revenue : parseMoney(item.revenue);

      return {
        cost: current.cost + cost,
        revenue: current.revenue + revenue,
      };
    },
    { cost: 0, revenue: 0 }
  );
  const margin = totals.revenue - totals.cost;

  return {
    ...totals,
    margin,
    marginPercent: totals.revenue > 0 ? (margin / totals.revenue) * 100 : 0,
  };
}

function splitLeadName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "Lead";

  return { firstName, lastName };
}

function normalizeBoard(lanes: Lane[]): Lane[] {
  return lanes
    .filter((lane) => !legacyStarterLaneIds.has(lane.id))
    .map((lane) => ({
      ...lane,
      tasks: lane.tasks.map((task) => ({
        ...task,
        status: task.status === "done" ? "done" : "in_progress",
        hidden: task.hidden === true,
        walletItems: task.walletItems ?? [],
      })),
    }));
}

export function BoardShell() {
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [newLaneTitle, setNewLaneTitle] = useState("");
  const [laneDrafts, setLaneDrafts] = useState<Record<string, DraftTask>>({});
  const [activeTaskModalLaneId, setActiveTaskModalLaneId] = useState<string | null>(null);
  const [activeTaskSearchLaneId, setActiveTaskSearchLaneId] = useState<string | null>(null);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [taskSearchStatus, setTaskSearchStatus] = useState<TaskStatusFilter>("all");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [leadEditorForm, setLeadEditorForm] = useState<UpdateLeadInput>(emptyLeadEditor);
  const [leadEditorCompanies, setLeadEditorCompanies] = useState<LeadCompanyRecord[]>([]);
  const [leadEditorFiles, setLeadEditorFiles] = useState<Array<LeadFileRecord & { fileDataBase64?: string }>>([]);
  const [leadEditorLogs, setLeadEditorLogs] = useState<LeadLogRecord[]>([]);
  const [leadEditorInvoices, setLeadEditorInvoices] = useState<LeadInvoiceRecord[]>([]);
  const [collapsedLogs, setCollapsedLogs] = useState<Record<string, boolean>>({});
  const [expandedLeadTaskId, setExpandedLeadTaskId] = useState<string | null>(null);
  const [leadTaskDrafts, setLeadTaskDrafts] = useState<
    Record<string, { notes: string; status: TaskStatus; walletItems: WalletDraftItem[] }>
  >({});
  const [leadLogMessage, setLeadLogMessage] = useState<string | null>(null);
  const [leadWalletMessage, setLeadWalletMessage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [photoFeedback, setPhotoFeedback] = useState<string | null>(null);
  const [isLoadingBoard, setIsLoadingBoard] = useState(true);
  const [boardMessage, setBoardMessage] = useState<string | null>(null);
  const [laneColors, setLaneColors] = useState<Record<string, LaneColorSettings>>(getInitialLaneColors);
  const [activeLaneColorId, setActiveLaneColorId] = useState<string | null>(null);
  const [draggedLaneId, setDraggedLaneId] = useState<string | null>(null);
  const [draggedTask, setDraggedTask] = useState<{
    laneId: string;
    taskId: string;
  } | null>(null);
  const [editingTask, setEditingTask] = useState<{
    laneId: string;
    taskId: string;
    title: string;
    notes: string;
    leadId?: string | null;
    leadSearch: string;
    status: TaskStatus;
    walletItems: WalletDraftItem[];
  } | null>(null);
  const hasLoadedBoardRef = useRef(false);
  const hasPersistedLaneColorsRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function loadBoard() {
      try {
        const response = await getTaskBoard();

        if (!isMounted) {
          return;
        }

        setLanes(normalizeBoard(response.lanes as Lane[]));
        setBoardMessage(null);
        hasLoadedBoardRef.current = true;
      } catch (error) {
        console.warn("[BoardShell] failed to load task board:", error);

        if (isMounted) {
          setBoardMessage("We could not load the saved task board yet.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingBoard(false);
        }
      }
    }

    void loadBoard();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasPersistedLaneColorsRef.current) {
      hasPersistedLaneColorsRef.current = true;
      return;
    }

    try {
      window.localStorage.setItem(laneColorStorageKey, JSON.stringify(laneColors));
    } catch (error) {
      console.warn("[BoardShell] failed to persist lane colors:", error);
    }
  }, [laneColors]);

  useEffect(() => {
    let isMounted = true;

    async function loadLeads() {
      try {
        const response = await getLeads();

        if (isMounted) {
          setLeads(response.leads);
        }
      } catch (error) {
        console.warn("[BoardShell] failed to load leads:", error);
      }
    }

    void loadLeads();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedBoardRef.current || isLoadingBoard) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        await saveTaskBoard(lanes);
      } catch (error) {
        console.warn("[BoardShell] failed to save task board:", error);
        setBoardMessage("We could not save the task board changes yet.");
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [isLoadingBoard, lanes]);

  async function persistBoard(nextLanes: Lane[]) {
    try {
      await saveTaskBoard(nextLanes);
      setBoardMessage(null);
    } catch (error) {
      console.warn("[BoardShell] failed to save task board:", error);
      setBoardMessage("We could not save the task board changes yet.");
    }
  }

  function setLanesAndPersist(nextLanes: Lane[]) {
    setLanes(nextLanes);
    void persistBoard(nextLanes);
  }

  function updateLaneColorSettings(laneId: string, patch: Partial<LaneColorSettings>) {
    setLaneColors((current) => ({
      ...current,
      [laneId]: {
        ...(current[laneId] ?? defaultLaneColor),
        ...patch,
      },
    }));
  }

  function resetLaneColorSettings(laneId: string) {
    setLaneColors((current) => {
      const next = { ...current };
      delete next[laneId];
      return next;
    });
  }

  function getLeadName(leadId?: string | null) {
    const lead = leads.find((item) => item.id === leadId);
    return lead ? getFullName(lead) : "";
  }

  function getLeadById(leadId?: string | null) {
    return leads.find((item) => item.id === leadId);
  }

  function getTaskLeadName(task: Task) {
    return getLeadName(task.leadId) || task.leadName || "";
  }

  function formatTaxId(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    return [digits.slice(0, 3), digits.slice(3, 5), digits.slice(5, 9)].filter(Boolean).join("-");
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
      console.warn("[BoardShell] failed to copy lead value:", error);
      setCopyFeedback(`We could not copy ${label}.`);
    }
  }

  async function openLeadEditor(lead: LeadRecord) {
    setSelectedLead(lead);
    setCopyFeedback(null);
    setPhotoFeedback(null);
    setLeadLogMessage(null);
    setLeadWalletMessage(null);
    setExpandedLeadTaskId(null);
    setLeadTaskDrafts({});
    setLeadEditorForm({
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

      setLeadEditorCompanies(companiesResponse.companies);
      setLeadEditorFiles(filesResponse.files);
      setLeadEditorLogs(logsResponse.logs);
      setLeadEditorInvoices(invoicesResponse.invoices);
    } catch (error) {
      console.warn("[BoardShell] failed to load lead resources:", error);
      setLeadEditorCompanies([]);
      setLeadEditorFiles([]);
      setLeadEditorLogs([]);
      setLeadEditorInvoices([]);
    }
  }

  async function copyTaxId() {
    if (!leadEditorForm.taxId) {
      setCopyFeedback("Add a Tax ID before copying.");
      return;
    }

    try {
      await navigator.clipboard.writeText(leadEditorForm.taxId);
      setCopyFeedback("Tax ID copied.");
    } catch (error) {
      console.warn("[BoardShell] failed to copy tax id:", error);
      setCopyFeedback("We could not copy the Tax ID.");
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

      setLeadEditorForm((current) => ({ ...current, leadPhotoDataUrl: compressed.dataUrl }));
      setPhotoFeedback(`Lead photo ready (${Math.ceil(compressed.size / 1024)} KB).`);
      event.target.value = "";
    } catch (error) {
      console.warn("[BoardShell] failed to compress lead photo:", error);
      setPhotoFeedback("We could not compress this photo under 300 KB.");
      event.target.value = "";
    }
  }

  async function saveLeadUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedLead) {
      return;
    }

    try {
      const response = await updateLead(selectedLead.id, {
        ...leadEditorForm,
        firstName: leadEditorForm.firstName.trim(),
        middleName: leadEditorForm.middleName?.trim(),
        lastName: leadEditorForm.lastName.trim(),
        phoneNumber: leadEditorForm.phoneNumber.trim(),
        email: leadEditorForm.email?.trim(),
        address: leadEditorForm.address?.trim(),
      });
      const updatedLeadName = getFullName(response.lead);
      const nextLanes = lanes.map((lane) => ({
        ...lane,
        tasks: lane.tasks.map((task) =>
          task.leadId === response.lead.id
            ? { ...task, leadName: updatedLeadName, leadSearch: updatedLeadName }
            : task
        ),
      }));

      setLeads((current) => current.map((lead) => (lead.id === response.lead.id ? response.lead : lead)));
      setLanesAndPersist(nextLanes);
      setSelectedLead(null);
    } catch (error) {
      console.warn("[BoardShell] failed to update lead:", error);
      setBoardMessage("We could not update this lead right now.");
    }
  }

  function getLeadTaskEntries(leadId: string) {
    return lanes.flatMap((lane) =>
      lane.tasks
        .filter((task) => task.leadId === leadId)
        .map((task) => ({
          laneId: lane.id,
          laneTitle: lane.title,
          task,
        }))
    );
  }

  function toggleLeadTaskEditor(task: Task) {
    setExpandedLeadTaskId((current) => (current === task.id ? null : task.id));
    setLeadTaskDrafts((current) => ({
      ...current,
      [task.id]: current[task.id] ?? {
        notes: task.notes,
        status: task.status,
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
        ...(current[taskId] ?? {
          notes: "",
          status: "in_progress",
          walletItems: defaultWalletItems.map((item) => ({ ...item })),
        }),
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
          walletItems:
            nextWalletItems.length > 0
              ? nextWalletItems
              : [{ id: "wallet-primary", description: "", cost: "", revenue: "" }],
        },
      };
    });
  }

  function saveLeadTaskUpdate(laneId: string, taskId: string) {
    const draft = leadTaskDrafts[taskId];

    if (!draft) {
      return;
    }

    const nextLanes = lanes.map((lane) =>
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

    setLanesAndPersist(nextLanes);
    setExpandedLeadTaskId(null);
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

      setLeadEditorLogs((current) => [response.log, ...current]);
      setCollapsedLogs((current) => ({ ...current, [response.log.id]: true }));
    } catch (error) {
      console.warn("[BoardShell] failed to create lead log:", error);
      setLeadLogMessage("We could not create this log yet.");
    }
  }

  async function updateLeadLogDraft(logId: string, patch: Partial<LeadLogRecord>) {
    setLeadLogMessage(null);
    const nextLogs = leadEditorLogs.map((log) => (log.id === logId ? { ...log, ...patch } : log));
    setLeadEditorLogs(nextLogs);

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
      setLeadEditorLogs((current) => current.map((log) => (log.id === logId ? response.log : log)));
    } catch (error) {
      console.warn("[BoardShell] failed to update lead log:", error);
      setLeadLogMessage("We could not save this log yet.");
    }
  }

  async function removeLeadLog(logId: string) {
    if (!selectedLead) {
      return;
    }

    setLeadLogMessage(null);
    setLeadEditorLogs((current) => current.filter((log) => log.id !== logId));

    try {
      await deleteLeadLog(selectedLead.id, logId);
    } catch (error) {
      console.warn("[BoardShell] failed to delete lead log:", error);
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
        const revenue = (task.walletItems ?? []).reduce((walletSum, item) => walletSum + parseMoney(String(item.revenue)), 0);
        return sum + revenue;
      }, 0);

    try {
      const response = await createLeadInvoice(selectedLead.id, {
        title: `${getFullName(selectedLead) || "Lead"} invoice ${leadEditorInvoices.length + 1}`,
        amount: suggestedAmount,
        status: "pending",
        issuedAt: new Date().toISOString().slice(0, 10),
        dueDate: "",
        notes: "",
        sourceTaskIds: linkedTasks,
      });
      setLeadEditorInvoices((current) => [response.invoice, ...current]);
    } catch (error) {
      console.warn("[BoardShell] failed to create invoice:", error);
      setLeadWalletMessage(error instanceof Error ? error.message : "We could not create this invoice yet.");
    }
  }

  async function updateInvoiceDraft(invoiceId: string, patch: Partial<LeadInvoiceRecord>) {
    if (!selectedLead) {
      return;
    }

    setLeadWalletMessage(null);
    const nextInvoices = leadEditorInvoices.map((invoice) =>
      invoice.id === invoiceId ? { ...invoice, ...patch } : invoice
    );
    setLeadEditorInvoices(nextInvoices);

    const nextInvoice = nextInvoices.find((invoice) => invoice.id === invoiceId);

    if (!nextInvoice) {
      return;
    }

    try {
      const response = await updateLeadInvoice(selectedLead.id, invoiceId, {
        title: nextInvoice.title.trim() || "Invoice",
        amount: Number(nextInvoice.amount ?? 0),
        status: nextInvoice.status,
        dueDate: nextInvoice.dueDate ?? "",
        issuedAt: nextInvoice.issuedAt ?? "",
        notes: nextInvoice.notes ?? "",
        sourceTaskIds: nextInvoice.sourceTaskIds ?? [],
      });
      setLeadEditorInvoices((current) =>
        current.map((invoice) =>
          invoice.id === invoiceId ? { ...response.invoice, installments: invoice.installments } : invoice
        )
      );
    } catch (error) {
      console.warn("[BoardShell] failed to update invoice:", error);
      setLeadWalletMessage(error instanceof Error ? error.message : "We could not save this invoice yet.");
    }
  }

  async function removeInvoice(invoiceId: string) {
    if (!selectedLead) {
      return;
    }

    setLeadWalletMessage(null);
    setLeadEditorInvoices((current) => current.filter((invoice) => invoice.id !== invoiceId));

    try {
      await deleteLeadInvoice(selectedLead.id, invoiceId);
    } catch (error) {
      console.warn("[BoardShell] failed to delete invoice:", error);
      setLeadWalletMessage(error instanceof Error ? error.message : "We could not delete this invoice yet.");
    }
  }

  async function addInstallment(invoiceId: string) {
    if (!selectedLead) {
      return;
    }

    setLeadWalletMessage(null);
    const invoice = leadEditorInvoices.find((item) => item.id === invoiceId);

    if (!invoice) {
      return;
    }

    try {
      const response = await createLeadInstallment(selectedLead.id, invoiceId, {
        amount: Number(invoice.amount ?? 0),
        dueDate: invoice.dueDate ?? "",
        status: "pending",
      });
      setLeadEditorInvoices((current) =>
        current.map((item) =>
          item.id === invoiceId ? { ...item, installments: [...item.installments, response.installment] } : item
        )
      );
    } catch (error) {
      console.warn("[BoardShell] failed to create installment:", error);
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
    const nextInvoices = leadEditorInvoices.map((invoice) =>
      invoice.id === invoiceId
        ? {
            ...invoice,
            installments: invoice.installments.map((installment) =>
              installment.id === installmentId ? { ...installment, ...patch } : installment
            ),
          }
        : invoice
    );
    setLeadEditorInvoices(nextInvoices);

    const nextInvoice = nextInvoices.find((invoice) => invoice.id === invoiceId);
    const nextInstallment = nextInvoice?.installments.find((installment) => installment.id === installmentId);

    if (!nextInstallment) {
      return;
    }

    try {
      const response = await updateLeadInstallment(selectedLead.id, invoiceId, installmentId, {
        amount: Number(nextInstallment.amount ?? 0),
        dueDate: nextInstallment.dueDate ?? "",
        status: nextInstallment.status,
        paidAt: nextInstallment.paidAt ?? "",
        paymentMethod: nextInstallment.paymentMethod ?? "",
        notes: nextInstallment.notes ?? "",
      });
      setLeadEditorInvoices((current) =>
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
      console.warn("[BoardShell] failed to update installment:", error);
      setLeadWalletMessage(error instanceof Error ? error.message : "We could not save this installment yet.");
    }
  }

  async function removeInstallment(invoiceId: string, installmentId: string) {
    if (!selectedLead) {
      return;
    }

    setLeadWalletMessage(null);
    setLeadEditorInvoices((current) =>
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
      console.warn("[BoardShell] failed to delete installment:", error);
      setLeadWalletMessage(error instanceof Error ? error.message : "We could not delete this installment yet.");
    }
  }

  function getLeadSearchResults(search: string) {
    const normalized = search.trim().toLowerCase();

    if (normalized.length < 6) {
      return [];
    }

    return leads
      .filter((lead) => {
        const leadName = getFullName(lead).toLowerCase();
        const phone = lead.phoneNumber.replace(/\D/g, "");
        const queryPhone = normalized.replace(/\D/g, "");

        return leadName.includes(normalized) || Boolean(queryPhone && phone.includes(queryPhone));
      })
      .slice(0, 5);
  }

  function getTaskTitleSearchResults(search: string) {
    const normalized = search.trim().toLowerCase();

    if (normalized.length < 4) {
      return [];
    }

    const titles = new Map<string, { title: string; count: number }>();

    for (const lane of lanes) {
      for (const task of lane.tasks) {
        const title = task.title.trim();

        if (!title || !title.toLowerCase().includes(normalized)) {
          continue;
        }

        const titleKey = title.toLowerCase();
        const current = titles.get(titleKey);
        titles.set(titleKey, {
          title,
          count: (current?.count ?? 0) + 1,
        });
      }
    }

    return Array.from(titles.values()).slice(0, 6);
  }

  function selectTaskTitleForDraft(laneId: string, title: string) {
    setLaneDrafts((current) => ({
      ...current,
      [laneId]: {
        ...(current[laneId] ?? emptyTaskDraft),
        title,
        titleWasSelected: true,
      },
    }));
  }

  function removeTaskTitleFromDraft(laneId: string) {
    setLaneDrafts((current) => ({
      ...current,
      [laneId]: {
        ...(current[laneId] ?? emptyTaskDraft),
        title: "",
        titleWasSelected: false,
      },
    }));
  }

  function addLane() {
    const title = newLaneTitle.trim();
    if (!title) return;

    const nextLanes = [
      ...lanes,
      {
        id: `lane-${crypto.randomUUID()}`,
        title,
        tasks: [],
      },
    ];

    setLanesAndPersist(nextLanes);
    setNewLaneTitle("");
  }

  function updateLaneTitle(laneId: string, title: string) {
    setLanes((current) => current.map((lane) => (lane.id === laneId ? { ...lane, title } : lane)));
  }

  function deleteLane(laneId: string) {
    const nextLanes = lanes.filter((lane) => lane.id !== laneId);

    setLanesAndPersist(nextLanes);
    setLaneDrafts((current) => {
      const next = { ...current };
      delete next[laneId];
      return next;
    });
    setActiveTaskModalLaneId((current) => (current === laneId ? null : current));
  }

  function updateLaneDraft(laneId: string, field: keyof DraftTask, value: string) {
    setLaneDrafts((current) => ({
      ...current,
      [laneId]: {
        ...(current[laneId] ?? emptyTaskDraft),
        [field]: value,
        ...(field === "title" ? { titleWasSelected: false } : null),
        ...(field === "leadSearch" ? { leadId: "" } : null),
      },
    }));
  }

  function attachLeadToDraft(laneId: string, lead: LeadRecord) {
    setLaneDrafts((current) => ({
      ...current,
      [laneId]: {
        ...(current[laneId] ?? emptyTaskDraft),
        leadId: lead.id,
        leadSearch: getFullName(lead),
      },
    }));
  }

  function removeLeadFromDraft(laneId: string) {
    setLaneDrafts((current) => ({
      ...current,
      [laneId]: {
        ...(current[laneId] ?? emptyTaskDraft),
        leadId: "",
        leadSearch: "",
      },
    }));
  }

  function updateDraftWalletItem(
    laneId: string,
    itemId: string,
    field: keyof Omit<WalletDraftItem, "id">,
    value: string
  ) {
    setLaneDrafts((current) => {
      const draft = current[laneId] ?? emptyTaskDraft;

      return {
        ...current,
        [laneId]: {
          ...draft,
          walletItems: draft.walletItems.map((item) =>
            item.id === itemId ? { ...item, [field]: value } : item
          ),
        },
      };
    });
  }

  function addDraftWalletItem(laneId: string) {
    setLaneDrafts((current) => {
      const draft = current[laneId] ?? emptyTaskDraft;

      return {
        ...current,
        [laneId]: {
          ...draft,
          walletItems: [
            ...draft.walletItems,
            { id: `wallet-${crypto.randomUUID()}`, description: "", cost: "", revenue: "" },
          ],
        },
      };
    });
  }

  function removeDraftWalletItem(laneId: string, itemId: string) {
    setLaneDrafts((current) => {
      const draft = current[laneId] ?? emptyTaskDraft;
      const nextWalletItems = draft.walletItems.filter((item) => item.id !== itemId);

      return {
        ...current,
        [laneId]: {
          ...draft,
          walletItems:
            nextWalletItems.length > 0
              ? nextWalletItems
              : [{ id: "wallet-primary", description: "", cost: "", revenue: "" }],
        },
      };
    });
  }

  async function createLeadForDraft(laneId: string) {
    const draft = laneDrafts[laneId] ?? emptyTaskDraft;
    const { firstName, lastName } = splitLeadName(draft.newLeadName);
    const phoneNumber = draft.newLeadPhone.trim();

    if (!firstName || !phoneNumber) {
      return;
    }

    setLaneDrafts((current) => ({
      ...current,
      [laneId]: {
        ...(current[laneId] ?? emptyTaskDraft),
        isCreatingLead: true,
      },
    }));

    try {
      const response = await createLeadRequest({
        firstName,
        lastName,
        phoneNumber,
      });
      const lead = response.lead as LeadRecord;
      const leadName = getFullName(lead);

      setLeads((current) => [lead, ...current]);
      setLaneDrafts((current) => ({
        ...current,
        [laneId]: {
          ...(current[laneId] ?? emptyTaskDraft),
          leadId: lead.id,
          leadSearch: leadName,
          newLeadName: "",
          newLeadPhone: "",
          isCreatingLead: false,
        },
      }));
    } catch (error) {
      console.warn("[BoardShell] failed to create lead from task modal:", error);
      setBoardMessage("We could not create this lead yet.");
      setLaneDrafts((current) => ({
        ...current,
        [laneId]: {
          ...(current[laneId] ?? emptyTaskDraft),
          isCreatingLead: false,
        },
      }));
    }
  }

  function openTaskModal(laneId: string) {
    setLaneDrafts((current) => ({
      ...current,
      [laneId]: current[laneId] ?? emptyTaskDraft,
    }));
    setActiveTaskModalLaneId(laneId);
  }

  function closeTaskModal() {
    setActiveTaskModalLaneId(null);
  }

  function closeTaskEditModal() {
    setEditingTask(null);
  }

  function updateEditingWalletItem(
    itemId: string,
    field: keyof Omit<WalletDraftItem, "id">,
    value: string
  ) {
    setEditingTask((current) =>
      current
        ? {
            ...current,
            walletItems: current.walletItems.map((item) =>
              item.id === itemId ? { ...item, [field]: value } : item
            ),
          }
        : current
    );
  }

  function addEditingWalletItem() {
    setEditingTask((current) =>
      current
        ? {
            ...current,
            walletItems: [
              ...current.walletItems,
              { id: `wallet-${crypto.randomUUID()}`, description: "", cost: "", revenue: "" },
            ],
          }
        : current
    );
  }

  function removeEditingWalletItem(itemId: string) {
    setEditingTask((current) => {
      if (!current) {
        return current;
      }

      const nextWalletItems = current.walletItems.filter((item) => item.id !== itemId);

      return {
        ...current,
        walletItems:
          nextWalletItems.length > 0
            ? nextWalletItems
            : [{ id: "wallet-primary", description: "", cost: "", revenue: "" }],
      };
    });
  }

  function attachLeadToEditing(lead: LeadRecord) {
    setEditingTask((current) =>
      current
        ? {
            ...current,
            leadId: lead.id,
            leadSearch: getFullName(lead),
          }
        : current
    );
  }

  function removeLeadFromEditing() {
    setEditingTask((current) =>
      current
        ? {
            ...current,
            leadId: "",
            leadSearch: "",
          }
        : current
    );
  }

  function openTaskSearch(laneId: string) {
    setActiveTaskSearchLaneId(laneId);
    setTaskSearchQuery("");
    setTaskSearchStatus("all");
    setSelectedTaskIds([]);
  }

  function closeTaskSearch() {
    setActiveTaskSearchLaneId(null);
    setTaskSearchQuery("");
    setTaskSearchStatus("all");
    setSelectedTaskIds([]);
  }

  function addTask(laneId: string) {
    const draft = laneDrafts[laneId] ?? emptyTaskDraft;
    const title = draft.title.trim();
    const notes = draft.notes.trim();
    const leadName = getLeadName(draft.leadId);
    const walletItems = toWalletItems(draft.walletItems, title);

    if (!title) return;
    if (draft.leadSearch.trim() && !draft.leadId) return;

    const nextLanes = lanes.map((lane) =>
      lane.id === laneId
        ? {
            ...lane,
            tasks: [
              ...lane.tasks,
              {
                id: `task-${crypto.randomUUID()}`,
                title,
                notes,
                leadId: draft.leadId || null,
                leadSearch: leadName || "",
                leadName: leadName || null,
                status: draft.status,
                walletItems,
              },
            ],
          }
        : lane
    );

    setLanesAndPersist(nextLanes);
    setLaneDrafts((current) => ({
      ...current,
      [laneId]: emptyTaskDraft,
    }));
    setActiveTaskModalLaneId(null);
  }

  function startEditingTask(laneId: string, taskId: string) {
    const lane = lanes.find((item) => item.id === laneId);
    const task = lane?.tasks.find((item) => item.id === taskId);
    if (!task) return;

    setEditingTask({
      laneId,
      taskId,
      title: task.title,
      notes: task.notes,
      leadId: task.leadId,
      leadSearch: getTaskLeadName(task),
      status: task.status,
      walletItems: toWalletDraftItems(task.walletItems),
    });
  }

  function saveTaskEdit() {
    if (!editingTask?.title.trim()) return;

    const nextLanes = lanes.map((item) =>
      item.id === editingTask.laneId
        ? {
            ...item,
            tasks: item.tasks.map((taskItem) =>
              taskItem.id === editingTask.taskId
                ? {
                    ...taskItem,
                    title: editingTask.title.trim(),
                    notes: editingTask.notes.trim(),
                    leadId: editingTask.leadId || null,
                    leadName: editingTask.leadId ? getLeadName(editingTask.leadId) || editingTask.leadSearch : null,
                    status: editingTask.status,
                    walletItems: toWalletItems(editingTask.walletItems, editingTask.title.trim()),
                  }
                : taskItem
            ),
          }
        : item
    );

    setLanesAndPersist(nextLanes);
    setEditingTask(null);
  }

  function deleteTask(laneId: string, taskId: string) {
    const nextLanes = lanes.map((lane) =>
      lane.id === laneId ? { ...lane, tasks: lane.tasks.filter((task) => task.id !== taskId) } : lane
    );

    setLanesAndPersist(nextLanes);
  }

  function changeTaskStatus(laneId: string, taskId: string, status: TaskStatus) {
    const nextLanes = lanes.map((lane) =>
      lane.id === laneId
        ? {
            ...lane,
            tasks: lane.tasks.map((task) => (task.id === taskId ? { ...task, status } : task)),
          }
        : lane
    );

    setLanesAndPersist(nextLanes);
  }

  function hideTask(laneId: string, taskId: string) {
    const nextLanes = lanes.map((lane) =>
      lane.id === laneId
        ? {
            ...lane,
            tasks: lane.tasks.map((task) => (task.id === taskId ? { ...task, hidden: true } : task)),
          }
        : lane
    );

    setLanesAndPersist(nextLanes);
  }

  function getTaskSearchResults() {
    const normalizedQuery = taskSearchQuery.trim().toLowerCase();

    return lanes
      .flatMap((lane) =>
        lane.tasks.map((task) => ({
          laneId: lane.id,
          laneTitle: lane.title,
          leadName: getTaskLeadName(task),
          task,
        }))
      )
      .filter(({ leadName, task }) => {
        const matchesStatus = taskSearchStatus === "all" || task.status === taskSearchStatus;

        if (!normalizedQuery) {
          return matchesStatus;
        }

        const searchableText = [task.title, task.notes, leadName].filter(Boolean).join(" ").toLowerCase();
        return matchesStatus && searchableText.includes(normalizedQuery);
      });
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]
    );
  }

  function selectAllTaskResults() {
    setSelectedTaskIds(getTaskSearchResults().map((result) => result.task.id));
  }

  function moveSelectedTasksToLane() {
    if (!activeTaskSearchLaneId || selectedTaskIds.length === 0) {
      return;
    }

    const selectedIdSet = new Set(selectedTaskIds);
    const selectedTasks = lanes.flatMap((lane) =>
      lane.tasks
        .filter((task) => selectedIdSet.has(task.id))
        .map((task) => ({
          ...task,
          hidden: false,
        }))
    );
    const withoutSelectedTasks = lanes.map((lane) => ({
      ...lane,
      tasks: lane.tasks.filter((task) => !selectedIdSet.has(task.id)),
    }));
    const nextLanes = withoutSelectedTasks.map((lane) =>
      lane.id === activeTaskSearchLaneId
        ? {
            ...lane,
            tasks: [...lane.tasks, ...selectedTasks],
          }
        : lane
    );

    setLanesAndPersist(nextLanes);
    closeTaskSearch();
  }

  function moveTask(targetLaneId: string, targetIndex?: number) {
    if (!draggedTask) return;

    const sourceLane = lanes.find((lane) => lane.id === draggedTask.laneId);
    const sourceTask = sourceLane?.tasks.find((task) => task.id === draggedTask.taskId);
    if (!sourceLane || !sourceTask) return;

    const withoutTask = lanes.map((lane) =>
      lane.id === draggedTask.laneId
        ? { ...lane, tasks: lane.tasks.filter((task) => task.id !== draggedTask.taskId) }
        : lane
    );

    const nextLanes = withoutTask.map((lane) => {
      if (lane.id !== targetLaneId) return lane;

      const nextTasks = [...lane.tasks];
      const insertionIndex = targetIndex ?? nextTasks.length;
      nextTasks.splice(insertionIndex, 0, sourceTask);
      return { ...lane, tasks: nextTasks };
    });

    setLanesAndPersist(nextLanes);
    setDraggedTask(null);
  }

  function reorderLane(targetLaneId: string) {
    if (!draggedLaneId || draggedLaneId === targetLaneId) return;

    const startIndex = lanes.findIndex((lane) => lane.id === draggedLaneId);
    const endIndex = lanes.findIndex((lane) => lane.id === targetLaneId);
    if (startIndex === -1 || endIndex === -1) return;

    setLanesAndPersist(reorder(lanes, startIndex, endIndex));
    setDraggedLaneId(null);
  }

  function reorderTaskWithinLane(laneId: string, taskId: string) {
    if (!draggedTask || draggedTask.laneId !== laneId || draggedTask.taskId === taskId) return;

    const nextLanes = lanes.map((lane) => {
      if (lane.id !== laneId) return lane;

      const startIndex = lane.tasks.findIndex((task) => task.id === draggedTask.taskId);
      const endIndex = lane.tasks.findIndex((task) => task.id === taskId);
      if (startIndex === -1 || endIndex === -1) return lane;

      return {
        ...lane,
        tasks: reorder(lane.tasks, startIndex, endIndex),
      };
    });

    setLanesAndPersist(nextLanes);
  }

  function renderWalletEditor({
    items,
    title,
    onUpdate,
    onAdd,
    onRemove,
  }: {
    items: WalletDraftItem[];
    title: string;
    onUpdate: (itemId: string, field: keyof Omit<WalletDraftItem, "id">, value: string) => void;
    onAdd: () => void;
    onRemove: (itemId: string) => void;
  }) {
    const totals = getWalletTotals(items);

    return (
      <section className={styles.walletPanel}>
        <div className={styles.walletHeader}>
          <h3>Wallet</h3>
          <button type="button" onClick={onAdd}>
            + New
          </button>
        </div>

        <div className={styles.walletRows}>
          {items.map((item, index) => (
            <div key={item.id} className={styles.walletRow}>
              <input
                value={item.description || (index === 0 ? title : "")}
                onChange={(event) => onUpdate(item.id, "description", event.target.value)}
                placeholder={index === 0 ? title || "Task name" : "Description"}
              />
              <input
                inputMode="decimal"
                value={item.cost}
                onChange={(event) => onUpdate(item.id, "cost", event.target.value)}
                placeholder="Cost"
              />
              <input
                inputMode="decimal"
                value={item.revenue}
                onChange={(event) => onUpdate(item.id, "revenue", event.target.value)}
                placeholder="Revenue"
              />
              <button type="button" onClick={() => onRemove(item.id)} aria-label="Remove wallet row">
                <X size={13} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        <div className={styles.walletTotals}>
          <div>
            <span>Total cost</span>
            <strong>{formatMoney(totals.cost)}</strong>
          </div>
          <div>
            <span>Revenue</span>
            <strong>{formatMoney(totals.revenue)}</strong>
          </div>
          <div>
            <span>Margin</span>
            <strong>{formatMoney(totals.margin)}</strong>
          </div>
          <div>
            <span>Margin %</span>
            <strong>{totals.marginPercent.toFixed(1)}%</strong>
          </div>
        </div>
      </section>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.boardTitle}>CRM Workflow Board</p>
          {isLoadingBoard || boardMessage ? (
            <p className={styles.srOnly}>{isLoadingBoard ? "Loading saved board..." : boardMessage}</p>
          ) : null}
        </div>

        <div className={styles.headerActions}>
          <div className={styles.navActions}>
            <Link href="/dashboard" className={styles.secondaryAction}>
              Back to dashboard
            </Link>
          </div>
          <div className={styles.addLaneBox}>
            <input
              value={newLaneTitle}
              onChange={(event) => setNewLaneTitle(event.target.value)}
              placeholder="New lane title"
            />
            <button type="button" onClick={addLane}>
              Create lane
            </button>
          </div>
        </div>
      </header>

      <section className={styles.boardViewport}>
        <div className={styles.board}>
          {lanes.map((lane) => (
            <article
              key={lane.id}
              className={styles.lane}
              style={
                laneColors[lane.id]
                  ? {
                      background: hexToRgba(
                        laneColors[lane.id].color,
                        laneColors[lane.id].opacity
                      ),
                    }
                  : undefined
              }
              onDragOver={(event) => {
                if (draggedLaneId) {
                  event.preventDefault();
                }
              }}
              onDrop={(event) => {
                if (!draggedLaneId || draggedTask) {
                  return;
                }

                event.preventDefault();
                reorderLane(lane.id);
              }}
            >
              <div
                className={styles.laneHeader}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => reorderLane(lane.id)}
              >
                <button
                  type="button"
                  className={styles.dragLaneButton}
                  draggable
                  onDragStart={(event) => {
                    event.stopPropagation();
                    event.dataTransfer.effectAllowed = "move";
                    setDraggedTask(null);
                    setDraggedLaneId(lane.id);
                  }}
                  onDragEnd={() => setDraggedLaneId(null)}
                  aria-label={`Move lane ${lane.title}`}
                  title="Drag lane"
                >
                  <GripVertical size={15} strokeWidth={2} aria-hidden="true" />
                </button>
                <input
                  className={styles.laneTitle}
                  value={lane.title}
                  onChange={(event) => updateLaneTitle(lane.id, event.target.value)}
                />
                <button type="button" className={styles.deleteLaneButton} onClick={() => deleteLane(lane.id)}>
                  <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
                  <span className={styles.srOnly}>Delete lane</span>
                </button>
              </div>
              <div className={styles.laneMetaRow}>
                <span>{lane.tasks.filter((task) => !task.hidden).length} cards</span>
                <div className={styles.laneQuickActions}>
                  <button
                    type="button"
                    className={styles.laneIconButton}
                    onClick={() => setActiveLaneColorId((current) => (current === lane.id ? null : lane.id))}
                    aria-label={`Change lane color for ${lane.title}`}
                  >
                    <Palette size={14} strokeWidth={2} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.laneIconButton}
                    onClick={() => openTaskSearch(lane.id)}
                    aria-label={`Search tasks in ${lane.title}`}
                  >
                    <Search size={14} strokeWidth={2} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.laneIconButton}
                    onClick={() => openTaskModal(lane.id)}
                    aria-label={`Create task in ${lane.title}`}
                  >
                    +
                  </button>
                </div>
              </div>

              {activeLaneColorId === lane.id ? (
                <div className={styles.laneColorPopover}>
                  <label className={styles.laneColorField}>
                    <span>Color</span>
                    <input
                      type="color"
                      value={laneColors[lane.id]?.color ?? defaultLaneColor.color}
                      onChange={(event) => updateLaneColorSettings(lane.id, { color: event.target.value })}
                    />
                  </label>

                  <label className={styles.laneColorField}>
                    <span>Transparency</span>
                    <input
                      type="range"
                      min="0.2"
                      max="1"
                      step="0.05"
                      value={laneColors[lane.id]?.opacity ?? defaultLaneColor.opacity}
                      onChange={(event) =>
                        updateLaneColorSettings(lane.id, { opacity: Number(event.target.value) })
                      }
                    />
                  </label>

                  <div className={styles.laneColorActions}>
                    <button type="button" className={styles.secondaryAction} onClick={() => resetLaneColorSettings(lane.id)}>
                      Reset
                    </button>
                    <button type="button" className={styles.secondaryAction} onClick={() => setActiveLaneColorId(null)}>
                      Close
                    </button>
                  </div>
                </div>
              ) : null}

              <div
                className={styles.taskList}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => moveTask(lane.id)}
              >
                {lane.tasks.filter((task) => !task.hidden).map((task) => {
                    const attachedLead = getLeadById(task.leadId);
                    const attachedLeadName = attachedLead ? getFullName(attachedLead) : task.leadName ?? "";
                    const attachedLeadInitials = getLeadInitials(attachedLeadName) || "L";

                    return (
                      <div
                        key={task.id}
                        className={styles.taskCard}
                        draggable
                        onDragStart={(event) => {
                          event.stopPropagation();
                          event.dataTransfer.effectAllowed = "move";
                          setDraggedLaneId(null);
                          setDraggedTask({ laneId: lane.id, taskId: task.id });
                        }}
                        onDragEnd={() => setDraggedTask(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.stopPropagation();
                          if (draggedTask?.laneId === lane.id) {
                            reorderTaskWithinLane(lane.id, task.id);
                          } else {
                            const targetIndex = lane.tasks.findIndex((item) => item.id === task.id);
                            moveTask(lane.id, targetIndex);
                          }
                        }}
                      >
                        <>
                            <div className={styles.taskHeader}>
                              <strong>{task.title}</strong>
                              <div className={styles.taskActions}>
                                <button type="button" onClick={() => startEditingTask(lane.id, task.id)}>
                                  <Pencil size={12} strokeWidth={2} aria-hidden="true" />
                                  <span className={styles.srOnly}>Edit task</span>
                                </button>
                                <button type="button" onClick={() => deleteTask(lane.id, task.id)}>
                                  <Trash2 size={12} strokeWidth={2} aria-hidden="true" />
                                  <span className={styles.srOnly}>Delete task</span>
                                </button>
                              </div>
                            </div>
                            {task.notes ? <p className={styles.taskDescriptionCard}>{task.notes}</p> : null}
                            {attachedLeadName ? (
                              <button
                                type="button"
                                className={`${styles.attachedLeadCard} ${
                                  attachedLead ? styles.attachedLeadButton : ""
                                }`}
                                onClick={() => {
                                  if (attachedLead) {
                                    void openLeadEditor(attachedLead);
                                  }
                                }}
                                disabled={!attachedLead}
                              >
                                <div className={styles.attachedLeadTopline}>
                                  <span className={styles.leadAvatar}>
                                    {attachedLead?.leadPhotoDataUrl ? (
                                      <img src={attachedLead.leadPhotoDataUrl} alt={attachedLeadName} />
                                    ) : (
                                      attachedLeadInitials
                                    )}
                                  </span>
                                  <div>
                                    <strong>{attachedLeadName}</strong>
                                    <small>Attached lead</small>
                                  </div>
                                  <MoreVertical size={12} strokeWidth={2.4} aria-hidden="true" />
                                </div>
                              </button>
                            ) : null}
                            <label
                              className={`${styles.taskStatusControl} ${
                                task.status === "done" ? styles.taskStatusDone : styles.taskStatusInProgress
                              }`}
                            >
                              <select
                                aria-label="Task status"
                                value={task.status}
                                onChange={(event) =>
                                  changeTaskStatus(
                                    lane.id,
                                    task.id,
                                    event.target.value === "done" ? "done" : "in_progress"
                                  )
                                }
                              >
                                <option value="in_progress">In progress</option>
                                <option value="done">Done</option>
                              </select>
                            </label>
                            {task.status === "done" ? (
                              <button
                                type="button"
                                className={styles.hideTaskButton}
                                onClick={() => hideTask(lane.id, task.id)}
                              >
                                Hide
                              </button>
                            ) : null}
                        </>
                      </div>
                    );
                  })}
              </div>
            </article>
          ))}
        </div>
      </section>

      {activeTaskModalLaneId ? (
        <div className={styles.modalOverlay} onClick={closeTaskModal}>
          <aside className={styles.taskModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>New task</p>
                <h2>Create task</h2>
              </div>
              <button type="button" className={styles.secondaryAction} onClick={closeTaskModal}>
                Close
              </button>
            </div>

            <label>
              <span>New task title</span>
              <div className={styles.taskTitleSearchBox}>
                {laneDrafts[activeTaskModalLaneId]?.titleWasSelected ? (
                  <div className={styles.selectedTitleBox}>
                    <div>
                      <strong>{laneDrafts[activeTaskModalLaneId]?.title}</strong>
                      <span>Selected task title</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTaskTitleFromDraft(activeTaskModalLaneId)}
                      aria-label="Remove selected task title"
                    >
                      <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={laneDrafts[activeTaskModalLaneId]?.title ?? ""}
                      onChange={(event) => updateLaneDraft(activeTaskModalLaneId, "title", event.target.value)}
                      placeholder="New task title"
                    />
                    {getTaskTitleSearchResults(laneDrafts[activeTaskModalLaneId]?.title ?? "").length > 0 ? (
                      <div className={styles.taskTitleSearchResults}>
                        {getTaskTitleSearchResults(laneDrafts[activeTaskModalLaneId]?.title ?? "").map((result) => (
                          <button
                            key={result.title.toLowerCase()}
                            type="button"
                            onClick={() => selectTaskTitleForDraft(activeTaskModalLaneId, result.title)}
                          >
                            <strong>{result.title}</strong>
                            <span>{result.count} existing task{result.count === 1 ? "" : "s"}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
              {!laneDrafts[activeTaskModalLaneId]?.leadId ? (
                <div className={styles.createLeadInline}>
                  <div>
                    <strong>Create a new lead</strong>
                    <span>Use only name and phone, then attach automatically.</span>
                  </div>
                  <input
                    value={laneDrafts[activeTaskModalLaneId]?.newLeadName ?? ""}
                    onChange={(event) => updateLaneDraft(activeTaskModalLaneId, "newLeadName", event.target.value)}
                    placeholder="Lead name"
                  />
                  <input
                    value={laneDrafts[activeTaskModalLaneId]?.newLeadPhone ?? ""}
                    onChange={(event) => updateLaneDraft(activeTaskModalLaneId, "newLeadPhone", event.target.value)}
                    placeholder="Phone number"
                  />
                  <button
                    type="button"
                    onClick={() => createLeadForDraft(activeTaskModalLaneId)}
                    disabled={laneDrafts[activeTaskModalLaneId]?.isCreatingLead}
                  >
                    {laneDrafts[activeTaskModalLaneId]?.isCreatingLead ? "Creating..." : "Create lead"}
                  </button>
                </div>
              ) : null}
            </label>

            <label>
              <span>Attach lead</span>
              <div className={styles.leadSearchBox}>
                {laneDrafts[activeTaskModalLaneId]?.leadId ? (
                  <div className={styles.selectedLeadBox}>
                    <div>
                      <strong>{laneDrafts[activeTaskModalLaneId]?.leadSearch}</strong>
                      <span>Selected lead</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLeadFromDraft(activeTaskModalLaneId)}
                      aria-label="Remove selected lead"
                    >
                      <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={laneDrafts[activeTaskModalLaneId]?.leadSearch ?? ""}
                      onChange={(event) => updateLaneDraft(activeTaskModalLaneId, "leadSearch", event.target.value)}
                      placeholder="Type at least 6 letters"
                    />
                    {getLeadSearchResults(laneDrafts[activeTaskModalLaneId]?.leadSearch ?? "").length > 0 ? (
                      <div className={styles.leadSearchResults}>
                        {getLeadSearchResults(laneDrafts[activeTaskModalLaneId]?.leadSearch ?? "").map((lead) => (
                          <button
                            key={lead.id}
                            type="button"
                            onClick={() => attachLeadToDraft(activeTaskModalLaneId, lead)}
                          >
                            <strong>{getFullName(lead)}</strong>
                            <span>{formatPhoneNumber(lead.phoneNumber)}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {(laneDrafts[activeTaskModalLaneId]?.leadSearch ?? "").trim().length >= 6 ? (
                      <small>Select an existing lead from the results.</small>
                    ) : null}
                  </>
                )}
              </div>
            </label>

            <label>
              <span>Task details</span>
              <textarea
                value={laneDrafts[activeTaskModalLaneId]?.notes ?? ""}
                onChange={(event) => updateLaneDraft(activeTaskModalLaneId, "notes", event.target.value)}
                placeholder="Task details"
                rows={4}
              />
            </label>

            <label>
              <span>Status</span>
              <select
                value={laneDrafts[activeTaskModalLaneId]?.status ?? "in_progress"}
                onChange={(event) =>
                  updateLaneDraft(
                    activeTaskModalLaneId,
                    "status",
                    event.target.value === "done" ? "done" : "in_progress"
                  )
                }
              >
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </label>

            {renderWalletEditor({
              items: laneDrafts[activeTaskModalLaneId]?.walletItems ?? emptyTaskDraft.walletItems,
              title: laneDrafts[activeTaskModalLaneId]?.title ?? "",
              onUpdate: (itemId, field, value) => updateDraftWalletItem(activeTaskModalLaneId, itemId, field, value),
              onAdd: () => addDraftWalletItem(activeTaskModalLaneId),
              onRemove: (itemId) => removeDraftWalletItem(activeTaskModalLaneId, itemId),
            })}

            <button
              type="button"
              className={styles.addTaskButton}
              disabled={Boolean(
                (laneDrafts[activeTaskModalLaneId]?.leadSearch ?? "").trim() &&
                  !laneDrafts[activeTaskModalLaneId]?.leadId
              )}
              onClick={() => addTask(activeTaskModalLaneId)}
            >
              Create task
            </button>
          </aside>
        </div>
      ) : null}

      {editingTask ? (
        <div className={styles.modalOverlay} onClick={closeTaskEditModal}>
          <aside className={styles.taskEditModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Edit task</p>
                <h2>{editingTask.title}</h2>
              </div>
              <button type="button" className={styles.secondaryAction} onClick={closeTaskEditModal}>
                Close
              </button>
            </div>

            <label>
              <span>Task title</span>
              <input
                value={editingTask.title}
                onChange={(event) =>
                  setEditingTask((current) => (current ? { ...current, title: event.target.value } : current))
                }
                placeholder="Task title"
              />
            </label>

            <section className={styles.richEditorPanel}>
              <span>Description</span>
              <div className={styles.richToolbar} aria-hidden="true">
                <button type="button">Sans Serif</button>
                <button type="button">Normal</button>
                <button type="button">B</button>
                <button type="button">I</button>
                <button type="button">U</button>
                <button type="button">H1</button>
                <button type="button">H2</button>
                <button type="button">"</button>
                <button type="button">•</button>
                <button type="button">≡</button>
                <button type="button">Link</button>
              </div>
              <textarea
                value={editingTask.notes}
                onChange={(event) =>
                  setEditingTask((current) => (current ? { ...current, notes: event.target.value } : current))
                }
                placeholder="Type here..."
              />
            </section>

            <label>
              <span>Attach lead</span>
              <div className={styles.leadSearchBox}>
                {editingTask.leadId ? (
                  <div className={styles.selectedLeadBox}>
                    <div>
                      <strong>{editingTask.leadSearch || getLeadName(editingTask.leadId)}</strong>
                      <span>Selected lead</span>
                    </div>
                    <button type="button" onClick={removeLeadFromEditing} aria-label="Remove selected lead">
                      <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={editingTask.leadSearch}
                      onChange={(event) =>
                        setEditingTask((current) =>
                          current ? { ...current, leadId: "", leadSearch: event.target.value } : current
                        )
                      }
                      placeholder="Type at least 6 letters"
                    />
                    {getLeadSearchResults(editingTask.leadSearch).length > 0 ? (
                      <div className={styles.leadSearchResults}>
                        {getLeadSearchResults(editingTask.leadSearch).map((lead) => (
                          <button key={lead.id} type="button" onClick={() => attachLeadToEditing(lead)}>
                            <strong>{getFullName(lead)}</strong>
                            <span>{formatPhoneNumber(lead.phoneNumber)}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {editingTask.leadSearch.trim().length >= 6 ? (
                      <small>Select an existing lead from the results.</small>
                    ) : null}
                  </>
                )}
              </div>
            </label>

            <label>
              <span>Status</span>
              <select
                value={editingTask.status}
                onChange={(event) =>
                  setEditingTask((current) =>
                    current
                      ? {
                          ...current,
                          status: event.target.value === "done" ? "done" : "in_progress",
                        }
                      : current
                  )
                }
              >
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </label>

            {renderWalletEditor({
              items: editingTask.walletItems,
              title: editingTask.title,
              onUpdate: updateEditingWalletItem,
              onAdd: addEditingWalletItem,
              onRemove: removeEditingWalletItem,
            })}

            <div className={styles.modalActionRow}>
              <button type="button" className={styles.secondaryAction} onClick={closeTaskEditModal}>
                Cancel
              </button>
              <button type="button" className={styles.addTaskButton} onClick={saveTaskEdit}>
                Save task
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {selectedLead ? (
        <div className={crmStyles.modalOverlay} onClick={() => setSelectedLead(null)}>
          <aside className={crmStyles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={crmStyles.modalHeader}>
              <div>
                <p className={crmStyles.modalEyebrow}>Lead profile</p>
                <h2>Edit lead</h2>
              </div>
              <button type="button" className={crmStyles.modalCloseButton} onClick={() => setSelectedLead(null)}>
                Close
              </button>
            </div>

            <form className={crmStyles.modalForm} onSubmit={saveLeadUpdate}>
              <section className={crmStyles.intakeSection}>
                <label className={crmStyles.avatarPreview}>
                  <input type="file" accept="image/jpeg,image/png" onChange={handleLeadPhotoChange} />
                  {leadEditorForm.leadPhotoDataUrl ? (
                    <img src={leadEditorForm.leadPhotoDataUrl} alt="Lead preview" />
                  ) : (
                    <span>{leadEditorForm.firstName.slice(0, 1) || "L"}</span>
                  )}
                  <small>{photoFeedback ?? "Click to add photo"} JPG/PNG, max 300 KB.</small>
                </label>

                <div className={crmStyles.intakeGrid}>
                  <label className={crmStyles.field}>
                    <span>First name</span>
                    <div className={crmStyles.copyInputWrap}>
                      <input
                        value={leadEditorForm.firstName}
                        onBlur={() =>
                          setLeadEditorForm((current) => ({ ...current, firstName: current.firstName.trim() }))
                        }
                        onChange={(event) =>
                          setLeadEditorForm((current) => ({ ...current, firstName: event.target.value }))
                        }
                        placeholder="First name"
                      />
                      <button
                        type="button"
                        onClick={() => void copyLeadValue(leadEditorForm.firstName, "First name")}
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
                        value={leadEditorForm.middleName}
                        onBlur={() =>
                          setLeadEditorForm((current) => ({ ...current, middleName: current.middleName?.trim() }))
                        }
                        onChange={(event) =>
                          setLeadEditorForm((current) => ({ ...current, middleName: event.target.value }))
                        }
                        placeholder="Middle name"
                      />
                      <button
                        type="button"
                        onClick={() => void copyLeadValue(leadEditorForm.middleName, "Middle name")}
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
                        value={leadEditorForm.lastName}
                        onBlur={() =>
                          setLeadEditorForm((current) => ({ ...current, lastName: current.lastName.trim() }))
                        }
                        onChange={(event) =>
                          setLeadEditorForm((current) => ({ ...current, lastName: event.target.value }))
                        }
                        placeholder="Last name"
                      />
                      <button
                        type="button"
                        onClick={() => void copyLeadValue(leadEditorForm.lastName, "Last name")}
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
                      value={leadEditorForm.dateOfBirth}
                      onChange={(event) =>
                        setLeadEditorForm((current) => ({ ...current, dateOfBirth: event.target.value }))
                      }
                    />
                  </label>

                  <div className={crmStyles.field}>
                    <span>Tax ID</span>
                    <div className={crmStyles.copyInputWrap}>
                      <input
                        inputMode="numeric"
                        maxLength={11}
                        value={leadEditorForm.taxId}
                        onChange={(event) =>
                          setLeadEditorForm((current) => ({ ...current, taxId: formatTaxId(event.target.value) }))
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
                      value={leadEditorForm.source}
                      onChange={(event) =>
                        setLeadEditorForm((current) => ({ ...current, source: event.target.value }))
                      }
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
                      value={leadEditorForm.gender}
                      onChange={(event) =>
                        setLeadEditorForm((current) => ({ ...current, gender: event.target.value }))
                      }
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
                        value={leadEditorForm.phoneNumber}
                        onBlur={() =>
                          setLeadEditorForm((current) => ({
                            ...current,
                            phoneNumber: formatPhoneNumber(current.phoneNumber.trim()),
                          }))
                        }
                        onChange={(event) =>
                          setLeadEditorForm((current) => ({
                            ...current,
                            phoneNumber: formatPhoneNumber(event.target.value),
                          }))
                        }
                        placeholder="(000) 000-0000"
                      />
                      <button
                        type="button"
                        onClick={() => void copyLeadValue(leadEditorForm.phoneNumber, "Phone number")}
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
                        value={leadEditorForm.email}
                        onBlur={() =>
                          setLeadEditorForm((current) => ({ ...current, email: current.email?.trim() }))
                        }
                        onChange={(event) =>
                          setLeadEditorForm((current) => ({ ...current, email: event.target.value }))
                        }
                        placeholder="client@email.com"
                      />
                      <button
                        type="button"
                        onClick={() => void copyLeadValue(leadEditorForm.email, "Email")}
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
                        value={leadEditorForm.address ?? ""}
                        onBlur={() =>
                          setLeadEditorForm((current) => ({ ...current, address: current.address?.trim() }))
                        }
                        onChange={(address) => setLeadEditorForm((current) => ({ ...current, address }))}
                        placeholder="Address"
                      />
                      <button
                        type="button"
                        onClick={() => void copyLeadValue(leadEditorForm.address, "Address")}
                        aria-label="Copy address"
                      >
                        <Copy size={17} />
                      </button>
                    </div>
                  </label>
                </div>
              </section>

              <section className={crmStyles.intakeSectionStack}>
                <div className={crmStyles.sectionTitleRow}>
                  <h3>Logs</h3>
                  <button type="button" onClick={addLeadLog} aria-label="Add lead log">
                    <Plus size={19} />
                  </button>
                </div>
                {leadLogMessage ? <p className={crmStyles.resourceMessage}>{leadLogMessage}</p> : null}
                <div className={styles.leadLogStack}>
                  {leadEditorLogs.map((log) => {
                    const isCollapsed = collapsedLogs[log.id] ?? true;

                    return (
                      <article key={log.id} className={styles.leadLogCard}>
                        <div className={styles.leadLogHeader}>
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
                              setLeadEditorLogs((current) =>
                                current.map((item) =>
                                  item.id === log.id ? { ...item, title: event.target.value } : item
                                )
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
                          <div className={styles.miniRichEditor}>
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
                                setLeadEditorLogs((current) =>
                                  current.map((item) =>
                                    item.id === log.id ? { ...item, description: event.target.value } : item
                                  )
                                )
                              }
                              onBlur={(event) =>
                                void updateLeadLogDraft(log.id, { description: event.target.value })
                              }
                              placeholder="Type log details..."
                            />
                          </div>
                        ) : null}
                      </article>
                    );
                  })}

                  {leadEditorLogs.length === 0 ? (
                    <p className={styles.leadEmptyState}>No logs for this lead yet.</p>
                  ) : null}
                </div>
              </section>

              <LeadResources
                leadId={selectedLead.id}
                companies={leadEditorCompanies}
                files={leadEditorFiles}
                onCompaniesChange={setLeadEditorCompanies}
                onFilesChange={setLeadEditorFiles}
                sections={["files"]}
              />

              <section className={crmStyles.intakeSectionStack}>
                <h3>Task log</h3>
                <div className={styles.leadTaskLogStack}>
                  {getLeadTaskEntries(selectedLead.id).map(({ laneId, laneTitle, task }) => {
                    const draft = leadTaskDrafts[task.id] ?? {
                      notes: task.notes,
                      status: task.status,
                      walletItems: toWalletDraftItems(task.walletItems),
                    };
                    const isExpanded = expandedLeadTaskId === task.id;

                    return (
                      <article key={task.id} className={styles.leadTaskLogCard}>
                        <button type="button" onClick={() => toggleLeadTaskEditor(task)}>
                          <div>
                            <strong>{task.title}</strong>
                            <span>{laneTitle}</span>
                          </div>
                          <small>{task.status === "done" ? "Done" : "In progress"}</small>
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>

                        {isExpanded ? (
                          <div className={styles.leadTaskEditor}>
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
                              <div className={styles.miniRichEditor}>
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
                            {renderWalletEditor({
                              items: draft.walletItems,
                              title: task.title,
                              onUpdate: (itemId, field, value) =>
                                updateLeadTaskWalletItem(task.id, itemId, field, value),
                              onAdd: () => addLeadTaskWalletItem(task.id),
                              onRemove: (itemId) => removeLeadTaskWalletItem(task.id, itemId),
                            })}
                            <button type="button" onClick={() => saveLeadTaskUpdate(laneId, task.id)}>
                              Save task
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}

                  {getLeadTaskEntries(selectedLead.id).length === 0 ? (
                    <p className={styles.leadEmptyState}>No tasks attached to this lead yet.</p>
                  ) : null}
                </div>
              </section>

              <LeadResources
                leadId={selectedLead.id}
                companies={leadEditorCompanies}
                files={leadEditorFiles}
                onCompaniesChange={setLeadEditorCompanies}
                onFilesChange={setLeadEditorFiles}
                sections={["companies"]}
              />

              <LeadWalletPanel
                leadName={getFullName(selectedLead)}
                tasks={getLeadTaskEntries(selectedLead.id).map(({ task }) => task)}
                invoices={leadEditorInvoices}
                message={leadWalletMessage}
                onAddInvoice={addLeadInvoice}
                onUpdateInvoice={updateInvoiceDraft}
                onDeleteInvoice={removeInvoice}
                onAddInstallment={addInstallment}
                onUpdateInstallment={updateInstallmentDraft}
                onDeleteInstallment={removeInstallment}
              />

              <div className={crmStyles.modalActions}>
                <button type="button" className={crmStyles.secondaryModalButton} onClick={() => setSelectedLead(null)}>
                  Cancel
                </button>
                <button type="submit" className={crmStyles.primaryModalButton}>
                  Save lead
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}

      {activeTaskSearchLaneId ? (
        <div className={styles.modalOverlay} onClick={closeTaskSearch}>
          <aside className={styles.taskSearchModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Search tasks</p>
                <h2>{lanes.find((lane) => lane.id === activeTaskSearchLaneId)?.title ?? "Lane"}</h2>
              </div>
              <button type="button" className={styles.secondaryAction} onClick={closeTaskSearch}>
                Close
              </button>
            </div>

            <div className={styles.taskSearchFilters}>
              <label>
                <span>Status</span>
                <select
                  value={taskSearchStatus}
                  onChange={(event) => setTaskSearchStatus(event.target.value as TaskStatusFilter)}
                >
                  <option value="all">All status</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
              </label>

              <label>
                <span>Lead or task</span>
                <input
                  value={taskSearchQuery}
                  onChange={(event) => setTaskSearchQuery(event.target.value)}
                  placeholder="Search lead name, task title, or details"
                />
              </label>
            </div>

            <div className={styles.taskSearchToolbar}>
              <span>{getTaskSearchResults().length} tasks found</span>
              <button type="button" onClick={selectAllTaskResults}>
                Select all
              </button>
            </div>

            <div className={styles.taskSearchResults}>
              {getTaskSearchResults().map(({ laneTitle, leadName, task }) => (
                <label key={task.id} className={styles.taskSearchResult}>
                  <input
                    type="checkbox"
                    checked={selectedTaskIds.includes(task.id)}
                    onChange={() => toggleTaskSelection(task.id)}
                  />
                  <div>
                    <strong>{task.title}</strong>
                    <span>{leadName || "No attached lead"}</span>
                    <small>
                      {laneTitle} - {task.status === "done" ? "Done" : "In progress"}
                      {task.hidden ? " - Hidden" : " - Live"}
                    </small>
                  </div>
                </label>
              ))}
            </div>

            <button
              type="button"
              className={styles.addTaskButton}
              disabled={selectedTaskIds.length === 0}
              onClick={moveSelectedTasksToLane}
            >
              Move selected tasks to this lane as live
            </button>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
