"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
  importLeadsCsv,
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
import { EngagementLetterModal } from "./engagement-letter-modal";
import { compressImageFile } from "../lib/image-compression";
import { useAuth } from "../contexts/AuthContext";
import boardStyles from "./board-shell.module.css";
import styles from "./leads-shell.module.css";
import crmStyles from "./crm-shell.module.css";

type TaskStatus = "todo" | "in_progress" | "done";
type WalletDraftItem = {
  id: string;
  description: string;
  cost: string;
  revenue: string;
};

type CsvColumnMapping = {
  leadName: string;
  taskTitle: string;
  revenue: string;
  cost: string;
};

const defaultWalletItems: WalletDraftItem[] = [
  { id: "wallet-primary", description: "", cost: "", revenue: "" },
];

const emptyEditor: UpdateLeadInput = {
  firstName: "",
  middleName: "",
  lastName: "",
  createdAt: "",
  leadPhotoDataUrl: "",
  dateOfBirth: "",
  taxId: "",
  spouseFirstName: "",
  spouseLastName: "",
  spouseDateOfBirth: "",
  spouseTaxId: "",
  gender: "Male",
  situation: "",
  phoneNumber: "",
  email: "",
  address: "",
  customerAcquisitionType: "",
  customerAcquisitionName: "",
  leadSourceId: "",
  leadSourceName: "",
  source: "lead",
  serviceInterest: "Tax preparation",
  preferredLanguage: "English",
  notes: "",
};

const leadCategoryOptions = ["client", "recovery", "lead", "Proposal rejected", "Disqualified"];
const LEADS_PAGE_SIZE = 20;

function fullName(lead: LeadRecord) {
  return [lead.firstName, lead.lastName].filter(Boolean).join(" ");
}

function initials(lead: LeadRecord) {
  const first = lead.firstName?.slice(0, 1) ?? "";
  const last = lead.lastName?.slice(0, 1) ?? "";
  return `${first}${last}` || "L";
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCsvHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function parseCsvLine(line: string) {
  const columns: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      columns.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  columns.push(current.trim());
  return columns;
}

function guessCsvColumn(headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map((alias) => normalizeCsvHeader(alias));

  return (
    headers.find((header) => normalizedAliases.includes(normalizeCsvHeader(header))) ??
    headers.find((header) =>
      normalizedAliases.some((alias) => normalizeCsvHeader(header).includes(alias) || alias.includes(normalizeCsvHeader(header)))
    ) ??
    ""
  );
}

function buildSuggestedCsvMapping(headers: string[]): CsvColumnMapping {
  return {
    leadName: guessCsvColumn(headers, ["lead_name", "lead name", "cliente", "client", "nome", "nome cliente"]),
    taskTitle: guessCsvColumn(headers, ["task_title", "task title", "servico", "serviço", "service", "task"]),
    revenue: guessCsvColumn(headers, ["valor servico", "valor serviço", "service value", "revenue", "valor"]),
    cost: guessCsvColumn(headers, ["custo", "cost", "custo servico", "service cost"]),
  };
}

function getUniqueCsvHeaders(headers: string[]) {
  const seen = new Set<string>();

  return headers.filter((header) => {
    const cleaned = header.replace(/\r/g, "").trim();
    const normalized = normalizeCsvHeader(cleaned);

    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
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

function getLeadState(address?: string | null) {
  if (!address?.trim()) {
    return "No state";
  }

  const match = address.match(/\b([A-Z]{2})\b(?:\s+\d{5}(?:-\d{4})?)?\s*$/i);
  return match?.[1]?.toUpperCase() ?? "No state";
}

function getTaskStatusLabel(status: TaskStatus) {
  if (status === "done") {
    return "Done";
  }

  if (status === "todo") {
    return "TODO";
  }

  return "In progress";
}

function toCompanyInput(company: LeadCompanyRecord) {
  return {
    companyName: company.companyName.trim(),
    ein: company.ein?.trim() || undefined,
    filingDate: company.filingDate?.trim() || undefined,
    principalAddress: company.principalAddress?.trim() || undefined,
    mailingAddress: company.mailingAddress?.trim() || undefined,
    entityType: company.entityType?.trim() || undefined,
    businessType: company.businessType?.trim() || undefined,
    otherDescription: company.otherDescription?.trim() || undefined,
    partners: company.partners ?? {},
  };
}

function normalizeTaskStatus(status?: string | null): TaskStatus {
  if (status === "done") {
    return "done";
  }

  if (status === "todo") {
    return "todo";
  }

  return "in_progress";
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
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

function getTagAccentVar(value?: string | null) {
  const normalized = formatTagLabel(value);
  const hash = Array.from(normalized).reduce((total, character) => total + character.charCodeAt(0), 0);
  return `var(--tag-accent-${(hash % 5) + 1})`;
}

export function LeadsShell() {
  const auth = useAuth();
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [searchResults, setSearchResults] = useState<LeadRecord[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchDirectoryRef = useRef<LeadRecord[] | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isEngagementLetterOpen, setIsEngagementLetterOpen] = useState(false);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [photoFeedback, setPhotoFeedback] = useState<string | null>(null);
  const [leadLogMessage, setLeadLogMessage] = useState<string | null>(null);
  const [leadWalletMessage, setLeadWalletMessage] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importYear, setImportYear] = useState(new Date().getFullYear());
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importColumns, setImportColumns] = useState<string[]>([]);
  const [importMapping, setImportMapping] = useState<CsvColumnMapping>({
    leadName: "",
    taskTitle: "",
    revenue: "",
    cost: "",
  });
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [leadsOffset, setLeadsOffset] = useState(0);
  const [leadsPagination, setLeadsPagination] = useState({
    total: 0,
    limit: LEADS_PAGE_SIZE,
    offset: 0,
    hasMore: false,
  });

  async function loadLeads(nextOffset = leadsOffset, nextSearch = searchQuery) {
    setIsLoading(true);
    setMessage(null);

    try {
      const normalizedSearch = nextSearch.trim();
      if (normalizedSearch) {
        if (!searchDirectoryRef.current) {
          const directoryResponse = await getLeads({ limit: 1000, offset: 0 });
          searchDirectoryRef.current = directoryResponse.leads;
        }

        const searchValue = normalizedSearch
          .toLocaleLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        const matchingLeads = (searchDirectoryRef.current ?? []).filter((lead) =>
          [fullName(lead), lead.email ?? "", lead.phoneNumber ?? ""]
            .join(" ")
            .toLocaleLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .includes(searchValue)
        );

        setLeads(matchingLeads.slice(nextOffset, nextOffset + LEADS_PAGE_SIZE));
        setLeadsPagination({
          total: matchingLeads.length,
          limit: LEADS_PAGE_SIZE,
          offset: nextOffset,
          hasMore: nextOffset + LEADS_PAGE_SIZE < matchingLeads.length,
        });
      } else {
        const response = await getLeads({ limit: LEADS_PAGE_SIZE, offset: nextOffset });
        setLeads(response.leads);
        setLeadsPagination(response.pagination);
      }
      setLeadsOffset(nextOffset);
    } catch (error) {
      console.warn("[LeadsShell] failed to load leads:", error);
      setMessage("We could not load leads right now.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      if (!isMounted) {
        return;
      }

      await loadLeads(0);
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadLeads(0, searchQuery);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    const normalizedQuery = searchQuery.trim();

    if (normalizedQuery.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          // Some published API stages still ignore the search query. Load the
          // directory from the DB once, then match the user's term reliably.
          if (!searchDirectoryRef.current) {
            const response = await getLeads({ limit: 1000, offset: 0 });
            searchDirectoryRef.current = response.leads;
          }

          const searchValue = normalizedQuery
            .toLocaleLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          const matches = (searchDirectoryRef.current ?? []).filter((lead) => {
            const searchableValue = [
              fullName(lead),
              lead.email ?? "",
              lead.phoneNumber ?? "",
            ]
              .join(" ")
              .toLocaleLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "");
            return searchableValue.includes(searchValue);
          });

          setSearchResults(matches.slice(0, 8));
          setSearchError(null);
        } catch (error) {
          console.warn("[LeadsShell] failed to search lead suggestions:", error);
          setSearchResults([]);
          setSearchError(error instanceof Error ? error.message : "Search is unavailable right now.");
        }
      })();
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

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
    return leads.filter((lead) => {
      const matchesTag = tagFilter === "all" || formatTagLabel(lead.source) === tagFilter;

      return matchesTag;
    });
  }, [leads, tagFilter]);

  const pageStart = leadsPagination.total === 0 ? 0 : leadsPagination.offset + 1;
  const pageEnd = leadsPagination.offset + filteredLeads.length;

  async function openLeadEditor(lead: LeadRecord) {
    setSelectedLead(lead);
    setIsLeadModalOpen(true);
    setIsEngagementLetterOpen(false);
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
      createdAt: lead.createdAt ? String(lead.createdAt).slice(0, 10) : "",
      leadPhotoDataUrl: lead.leadPhotoDataUrl ?? "",
      dateOfBirth: lead.dateOfBirth ? String(lead.dateOfBirth).slice(0, 10) : "",
      taxId: lead.taxId ?? "",
      spouseFirstName: lead.spouseFirstName ?? "",
      spouseLastName: lead.spouseLastName ?? "",
      spouseDateOfBirth: lead.spouseDateOfBirth ? String(lead.spouseDateOfBirth).slice(0, 10) : "",
      spouseTaxId: lead.spouseTaxId ?? "",
      gender: lead.gender ?? "Male",
      situation: lead.situation ?? "",
      phoneNumber: formatPhoneNumber(lead.phoneNumber),
      email: lead.email ?? "",
      address: lead.address ?? "",
      customerAcquisitionType: lead.customerAcquisitionType ?? "",
      customerAcquisitionName: lead.customerAcquisitionName ?? "",
      leadSourceId: lead.leadSourceId ?? "",
      leadSourceName: lead.leadSourceName ?? "",
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
    setIsEngagementLetterOpen(false);
    setCopyFeedback(null);
    setPhotoFeedback(null);
    setLeadLogMessage(null);
    setLeadWalletMessage(null);
    setExpandedLeadTaskId(null);
    setLeadTaskDrafts({});
    setEditorForm({ ...emptyEditor, createdAt: getTodayDate() });
    setEditorCompanies([]);
    setEditorFiles([]);
    setEditorLogs([]);
    setEditorInvoices([]);
  }

  function renderSearchBox(className?: string) {
    return (
      <div className={`${styles.searchInputWrap} ${className ?? ""}`.trim()}>
        <input
          className={styles.inlineSearch}
          value={searchQuery}
          onBlur={() => {
            window.setTimeout(() => setSearchQuery((current) => current.trim()), 120);
          }}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by name, phone, or email"
        />
        {searchQuery.trim().length >= 2 ? (
          <div className={styles.searchResults}>
            {searchError ? (
              <div className={styles.searchResultEmpty}>{searchError}</div>
            ) : searchResults.length > 0 ? (
              searchResults.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  className={styles.searchResultButton}
                  onClick={() => {
                    setSearchQuery(fullName(lead));
                    setSearchResults([]);
                    void openLeadEditor(lead);
                  }}
                >
                  <strong>{fullName(lead)}</strong>
                  <span>{lead.email?.trim() || formatPhoneNumber(lead.phoneNumber) || "Lead record"}</span>
                </button>
              ))
            ) : (
              <div className={styles.searchResultEmpty}>No lead found with this search.</div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  async function handleImportCsv() {
    if (!importFile) {
      setMessage("Choose a CSV file to import.");
      return;
    }

    if (!importMapping.leadName || !importMapping.taskTitle || !importMapping.revenue || !importMapping.cost) {
      setMessage("Map the CSV columns for lead name, task title, service value, and cost before importing.");
      return;
    }

    setIsImportingCsv(true);
    setMessage(null);

    try {
      const bytes = new Uint8Array(await importFile.arrayBuffer());
      let binary = "";

      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });

      const csvBase64 = btoa(binary);
      const response = await importLeadsCsv({ csvBase64, importYear, columnMapping: importMapping });
      await loadLeads();
      setIsImportModalOpen(false);
      setImportFile(null);
      setImportColumns([]);
      setImportMapping({ leadName: "", taskTitle: "", revenue: "", cost: "" });
      setMessage(
        `${response.createdLeads} leads created, ${response.createdTasks} tasks created, ${response.updatedTasks} tasks updated.`
      );
    } catch (error) {
      console.warn("[LeadsShell] failed to import CSV:", error);
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        setMessage("We could not reach the CSV import API. If the online backend has not been deployed with /leads/import yet, publish the latest crm-IaC first.");
      } else {
        setMessage(error instanceof Error ? error.message : "We could not import this CSV right now.");
      }
    } finally {
      setIsImportingCsv(false);
    }
  }

  async function handleImportFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImportFile(file);

    if (!file) {
      setImportColumns([]);
      setImportMapping({ leadName: "", taskTitle: "", revenue: "", cost: "" });
      return;
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";

      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });

      const firstLine = binary.split(/\r?\n/).map((line) => line.trimEnd()).find(Boolean) ?? "";
      const headers = getUniqueCsvHeaders(parseCsvLine(firstLine).map((header) => header.replace(/\r/g, "").trim()));

      setImportColumns(headers);
      setImportMapping(buildSuggestedCsvMapping(headers));
    } catch (error) {
      console.warn("[LeadsShell] failed to read CSV headers:", error);
      setImportColumns([]);
      setImportMapping({ leadName: "", taskTitle: "", revenue: "", cost: "" });
      setMessage("We could not read the CSV columns.");
    }
  }

  function closeLeadModal() {
    setSelectedLead(null);
    setIsLeadModalOpen(false);
    setIsEngagementLetterOpen(false);
    setCopyFeedback(null);
    setPhotoFeedback(null);
    setLeadLogMessage(null);
    setLeadWalletMessage(null);
    setExpandedLeadTaskId(null);
    setLeadTaskDrafts({});
    setEditorInvoices([]);
  }

  async function openEngagementLetter() {
    if (!selectedLead) {
      return;
    }

    setIsEngagementLetterOpen(true);

    try {
      const response = await getLeadCompanies(selectedLead.id);
      setEditorCompanies(response.companies);
    } catch (error) {
      console.warn("[LeadsShell] failed to refresh companies for engagement letter:", error);
      setMessage("We could not refresh this lead's companies. Please close and reopen the lead, then try again.");
    }
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
        createdAt: editorForm.createdAt?.trim() || undefined,
        phoneNumber: editorForm.phoneNumber?.trim() ?? "",
        email: editorForm.email?.trim(),
        address: editorForm.address?.trim(),
        situation: editorForm.situation?.trim(),
        spouseFirstName: editorForm.spouseFirstName?.trim() || undefined,
        spouseLastName: editorForm.spouseLastName?.trim() || undefined,
        spouseDateOfBirth: editorForm.spouseDateOfBirth?.trim() || undefined,
        spouseTaxId: editorForm.spouseTaxId?.trim() || undefined,
        customerAcquisitionType: editorForm.customerAcquisitionType?.trim() || undefined,
        customerAcquisitionName: editorForm.customerAcquisitionName?.trim() || undefined,
        leadSourceId: editorForm.leadSourceId?.trim() || undefined,
        leadSourceName: editorForm.leadSourceName?.trim() || undefined,
      };

      if (selectedLead) {
        const response = await updateLead(selectedLead.id, payload);
        setLeads((current) => current.map((lead) => (lead.id === selectedLead.id ? response.lead : lead)));
      } else {
        const response = await createLead({
          ...payload,
          companies: editorCompanies
            .map(toCompanyInput)
            .filter((company) => company.companyName && company.companyName !== "New company"),
        });
        setLeads((current) => [response.lead, ...current]);
      }

      closeLeadModal();
    } catch (error) {
      console.warn("[LeadsShell] failed to update lead:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : selectedLead
            ? "We could not update this lead right now."
            : "We could not create this lead right now."
      );
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
        status: normalizeTaskStatus(task.status),
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
          <Link href="/dashboard" className={styles.dashboardLink}>Dashboard</Link>
          <div className={styles.headerTools}>
          <button type="button" className={styles.filterToggle} onClick={() => setIsFilterOpen((current) => !current)}>
            <Filter size={16} strokeWidth={2} aria-hidden="true" />
            Filters
          </button>
          <button type="button" className={styles.filterToggle} onClick={() => setIsImportModalOpen(true)}>
            Import CSV
          </button>
          </div>
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
            <span>Search</span>
            {renderSearchBox(styles.filterSearchBox)}
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
                setSearchQuery("");
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
          <span>{isLoading ? "Loading..." : `${pageStart}-${pageEnd} of ${leadsPagination.total}`}</span>
          <div className={styles.paginationRow}>
            <button
              type="button"
              className={styles.filterToggle}
              onClick={() => void loadLeads(Math.max(0, leadsOffset - LEADS_PAGE_SIZE))}
              disabled={isLoading || leadsOffset === 0}
            >
              Previous
            </button>
            <button
              type="button"
              className={styles.filterToggle}
              onClick={() => void loadLeads(leadsOffset + LEADS_PAGE_SIZE)}
              disabled={isLoading || !leadsPagination.hasMore}
            >
              Next
            </button>
          </div>
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
              <div className={styles.contactRow}>
                <span>Client since</span>
                <span>{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("en-US") : "No date"}</span>
              </div>
              <div className={styles.contactRow}>
                <span>State</span>
                <span>{getLeadState(lead.address)}</span>
              </div>
              <div className={styles.cardFooter}>
                <span
                  className={styles.tagPill}
                  style={{ ["--tag-pill-accent" as string]: getTagAccentVar(lead.source) }}
                >
                  {formatTagLabel(lead.source)}
                </span>
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
                    <span>Created date</span>
                    <input
                      type="date"
                      value={editorForm.createdAt ?? ""}
                      onChange={(event) => setEditorForm((current) => ({ ...current, createdAt: event.target.value }))}
                    />
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
                    <span>Status</span>
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

                  {selectedLead ? (
                    <div className={crmStyles.field}>
                      <span>Engagement letter</span>
                      <button
                        type="button"
                        className={crmStyles.engagementLetterButton}
                        onClick={() => void openEngagementLetter()}
                      >
                        Prepare engagement letter
                      </button>
                    </div>
                  ) : null}

                  <label className={crmStyles.field}>
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

                  <label className={crmStyles.field}>
                    <span>Situation</span>
                    <input
                      value={editorForm.situation ?? ""}
                      onBlur={() => setEditorForm((current) => ({ ...current, situation: current.situation?.trim() }))}
                      onChange={(event) => setEditorForm((current) => ({ ...current, situation: event.target.value }))}
                      placeholder="SSN, ITIN, student, NRA..."
                    />
                  </label>
                </div>
              </section>

              <section className={crmStyles.intakeSectionStack}>
                <h3>Spouse</h3>
                <div className={crmStyles.intakeGrid}>
                  <label className={crmStyles.field}>
                    <span>First name</span>
                    <input
                      value={editorForm.spouseFirstName ?? ""}
                      onChange={(event) => setEditorForm((current) => ({ ...current, spouseFirstName: event.target.value }))}
                      placeholder="First name"
                    />
                  </label>
                  <label className={crmStyles.field}>
                    <span>Last name</span>
                    <input
                      value={editorForm.spouseLastName ?? ""}
                      onChange={(event) => setEditorForm((current) => ({ ...current, spouseLastName: event.target.value }))}
                      placeholder="Last name"
                    />
                  </label>
                  <label className={crmStyles.field}>
                    <span>Date of birth</span>
                    <input
                      type="date"
                      value={editorForm.spouseDateOfBirth ?? ""}
                      onChange={(event) => setEditorForm((current) => ({ ...current, spouseDateOfBirth: event.target.value }))}
                    />
                  </label>
                  <label className={crmStyles.field}>
                    <span>SSN / ITIN</span>
                    <input
                      inputMode="numeric"
                      maxLength={11}
                      value={editorForm.spouseTaxId ?? ""}
                      onChange={(event) =>
                        setEditorForm((current) => ({ ...current, spouseTaxId: formatTaxId(event.target.value) }))
                      }
                      placeholder="xxx-xx-xxxx"
                    />
                  </label>
                </div>
              </section>

              <LeadResources
                leadId={selectedLead?.id}
                companies={editorCompanies}
                files={editorFiles}
                onCompaniesChange={setEditorCompanies}
                onFilesChange={setEditorFiles}
                sections={["companies"]}
              />

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
                            phoneNumber: formatPhoneNumber((current.phoneNumber ?? "").trim()),
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
                      status: normalizeTaskStatus(task.status),
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
                                  <small>{getTaskStatusLabel(draft.status)}</small>
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
                                    status:
                                      event.target.value === "done"
                                        ? "done"
                                        : event.target.value === "todo"
                                          ? "todo"
                                          : "in_progress",
                                  })
                                }
                              >
                                <option value="todo">TODO</option>
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
                              Save changes
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
                <section className={crmStyles.intakeSectionStack}>
                  <h3>Customer acquisition</h3>
                  <div className={crmStyles.contactGrid}>
                    <label className={crmStyles.field}>
                      <span>Type</span>
                      <input
                        value={editorForm.customerAcquisitionType ?? ""}
                        onBlur={() =>
                          setEditorForm((current) => ({
                            ...current,
                            customerAcquisitionType: current.customerAcquisitionType?.trim(),
                          }))
                        }
                        onChange={(event) =>
                          setEditorForm((current) => ({
                            ...current,
                            customerAcquisitionType: event.target.value,
                          }))
                        }
                        placeholder="Referral, Campaign, Walk-in..."
                      />
                    </label>

                    <label className={crmStyles.field}>
                      <span>Source / company</span>
                      <input
                        value={editorForm.customerAcquisitionName ?? ""}
                        onBlur={() =>
                          setEditorForm((current) => ({
                            ...current,
                            customerAcquisitionName: current.customerAcquisitionName?.trim(),
                          }))
                        }
                        onChange={(event) =>
                          setEditorForm((current) => ({
                            ...current,
                            customerAcquisitionName: event.target.value,
                          }))
                        }
                        placeholder="Who sent this client or where they came from"
                      />
                    </label>
                  </div>
                </section>
              ) : null}

              {selectedLead ? (
                <LeadWalletPanel
                  leadName={fullName(selectedLead)}
                  tasks={getLeadTaskEntries(selectedLead.id).map(({ task }) => ({
                    ...task,
                    status: task.status === "done" ? "done" : "in_progress",
                  }))}
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
                  {selectedLead ? "Save changes" : "Create lead"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}

      {isEngagementLetterOpen && selectedLead ? (
        <EngagementLetterModal
          lead={selectedLead}
          companies={editorCompanies}
          currentUserName={[auth.user?.firstName, auth.user?.lastName].filter(Boolean).join(" ")}
          onClose={() => setIsEngagementLetterOpen(false)}
        />
      ) : null}

      {isImportModalOpen ? (
        <div className={crmStyles.modalOverlay} onClick={() => setIsImportModalOpen(false)}>
          <aside className={styles.importModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.importModalHeader}>
              <div>
                <p className={styles.eyebrow}>Batch import</p>
                <h2>Import leads and tasks</h2>
                <p>Upload your CSV and choose the year that should be used as the created date for these old records.</p>
              </div>
              <button type="button" className={styles.filterToggle} onClick={() => setIsImportModalOpen(false)}>
                Close
              </button>
            </div>

            <div className={styles.importForm}>
              <label>
                <span>CSV file</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleImportFileChange}
                />
              </label>

              <label>
                <span>Created year</span>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={importYear}
                  onChange={(event) => setImportYear(Number(event.target.value || new Date().getFullYear()))}
                />
              </label>

              {importColumns.length > 0 ? (
                <div className={styles.importMappingGrid}>
                  <label>
                    <span>Lead name column</span>
                    <select
                      value={importMapping.leadName}
                      onChange={(event) =>
                        setImportMapping((current) => ({ ...current, leadName: event.target.value }))
                      }
                    >
                      <option value="">Select a column</option>
                      {importColumns.map((column, index) => (
                        <option key={`lead-${index}-${column}`} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Task title column</span>
                    <select
                      value={importMapping.taskTitle}
                      onChange={(event) =>
                        setImportMapping((current) => ({ ...current, taskTitle: event.target.value }))
                      }
                    >
                      <option value="">Select a column</option>
                      {importColumns.map((column, index) => (
                        <option key={`task-${index}-${column}`} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Service value column</span>
                    <select
                      value={importMapping.revenue}
                      onChange={(event) =>
                        setImportMapping((current) => ({ ...current, revenue: event.target.value }))
                      }
                    >
                      <option value="">Select a column</option>
                      {importColumns.map((column, index) => (
                        <option key={`revenue-${index}-${column}`} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Cost column</span>
                    <select
                      value={importMapping.cost}
                      onChange={(event) =>
                        setImportMapping((current) => ({ ...current, cost: event.target.value }))
                      }
                    >
                      <option value="">Select a column</option>
                      {importColumns.map((column, index) => (
                        <option key={`cost-${index}-${column}`} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              <p className={styles.importHint}>
                We will use January 1 of the selected year as the created date for imported leads and tasks.
                {importColumns.length > 0 ? " Review the mapped columns before importing." : ""}
              </p>

              <div className={styles.importActions}>
                <button type="button" className={styles.filterToggle} onClick={() => setIsImportModalOpen(false)}>
                  Cancel
                </button>
                <button type="button" className={styles.primaryLinkButton} onClick={handleImportCsv} disabled={isImportingCsv}>
                  {isImportingCsv ? "Importing..." : "Import CSV"}
                </button>
              </div>
            </div>
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
