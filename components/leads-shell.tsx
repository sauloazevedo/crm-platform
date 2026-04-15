"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import {
  deleteLead,
  getLeadCompanies,
  getLeadFiles,
  getLeads,
  updateLead,
  type LeadCompanyRecord,
  type LeadFileRecord,
  type LeadRecord,
  type UpdateLeadInput,
} from "../lib/crm-api";
import { LeadResources } from "./lead-resources";
import { AddressAutocomplete } from "./address-autocomplete";
import { ThemeToggle } from "./theme-toggle";
import styles from "./leads-shell.module.css";
import crmStyles from "./crm-shell.module.css";

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
  source: "Users",
  serviceInterest: "Tax preparation",
  preferredLanguage: "English",
  notes: "",
};

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

export function LeadsShell() {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<LeadRecord | null>(null);
  const [editorForm, setEditorForm] = useState<UpdateLeadInput>(emptyEditor);
  const [editorCompanies, setEditorCompanies] = useState<LeadCompanyRecord[]>([]);
  const [editorFiles, setEditorFiles] = useState<Array<LeadFileRecord & { fileDataBase64?: string }>>([]);
  const [nameSearch, setNameSearch] = useState("");
  const [phoneSearch, setPhoneSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [photoFeedback, setPhotoFeedback] = useState<string | null>(null);

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

  const statuses = useMemo(() => {
    const values = new Set(leads.map((lead) => lead.status || "new"));
    return ["all", ...Array.from(values).sort()];
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const normalizedName = normalize(nameSearch);
    const normalizedPhone = normalizePhone(phoneSearch);

    return leads.filter((lead) => {
      const matchesName = !normalizedName || normalize(fullName(lead)).includes(normalizedName);
      const matchesPhone = !normalizedPhone || normalizePhone(lead.phoneNumber).includes(normalizedPhone);
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;

      return matchesName && matchesPhone && matchesStatus;
    });
  }, [leads, nameSearch, phoneSearch, statusFilter]);

  async function openLeadEditor(lead: LeadRecord) {
    setSelectedLead(lead);
    setCopyFeedback(null);
    setPhotoFeedback(null);
    setEditorForm({
      firstName: lead.firstName ?? "",
      middleName: lead.middleName ?? "",
      lastName: lead.lastName ?? "",
      leadPhotoDataUrl: lead.leadPhotoDataUrl ?? "",
      dateOfBirth: lead.dateOfBirth ? String(lead.dateOfBirth).slice(0, 10) : "",
      taxId: lead.taxId ?? "",
      gender: lead.gender ?? "Male",
      phoneNumber: lead.phoneNumber ?? "",
      email: lead.email ?? "",
      address: lead.address ?? "",
      source: lead.source ?? "Users",
      serviceInterest: lead.serviceInterest ?? "Tax preparation",
      preferredLanguage: lead.preferredLanguage ?? "English",
      notes: lead.notes ?? "",
    });

    try {
      const [companiesResponse, filesResponse] = await Promise.all([
        getLeadCompanies(lead.id),
        getLeadFiles(lead.id),
      ]);

      setEditorCompanies(companiesResponse.companies);
      setEditorFiles(filesResponse.files);
    } catch (error) {
      console.warn("[LeadsShell] failed to load lead resources:", error);
      setEditorCompanies([]);
      setEditorFiles([]);
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

  function handleLeadPhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setPhotoFeedback("Use a JPG or PNG image.");
      return;
    }

    if (file.size > 300_000) {
      setPhotoFeedback("Use an image smaller than 300 KB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";

      setEditorForm((current) => ({ ...current, leadPhotoDataUrl: result }));
      setPhotoFeedback("Lead photo ready.");
      event.target.value = "";
    };

    reader.onerror = () => {
      setPhotoFeedback("We could not read this image.");
      event.target.value = "";
    };

    reader.readAsDataURL(file);
  }

  async function saveLeadUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedLead) {
      return;
    }

    try {
      const response = await updateLead(selectedLead.id, {
        ...editorForm,
        firstName: editorForm.firstName.trim(),
        middleName: editorForm.middleName?.trim(),
        lastName: editorForm.lastName.trim(),
        phoneNumber: editorForm.phoneNumber.trim(),
        email: editorForm.email?.trim(),
        address: editorForm.address?.trim(),
      });

      setLeads((current) => current.map((lead) => (lead.id === selectedLead.id ? response.lead : lead)));
      setSelectedLead(null);
    } catch (error) {
      console.warn("[LeadsShell] failed to update lead:", error);
      setMessage("We could not update this lead right now.");
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
          <p>Search and filter your lead directory by name, phone, and status.</p>
        </div>
        <div className={styles.headerActions}>
          <ThemeToggle />
          <Link href="/dashboard">Back to dashboard</Link>
          <Link href="/crm" className={styles.primaryLink}>
            CRM
          </Link>
        </div>
      </header>

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
          <span>Status Filter</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "Status" : status}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className={styles.directoryHeader}>
        <h2>Directory ({isLoading ? "..." : filteredLeads.length})</h2>
        {message ? <p>{message}</p> : null}
      </section>

      <section className={styles.tableCard}>
        <div className={styles.tableHead}>
          <span>Record</span>
          <span>Phone</span>
          <span>Status</span>
          <span aria-label="Actions" />
        </div>

        {filteredLeads.map((lead) => (
          <article key={lead.id} className={styles.tableRow}>
            <button type="button" className={styles.recordCell} onClick={() => void openLeadEditor(lead)}>
              <div className={styles.avatar}>
                {lead.leadPhotoDataUrl ? (
                  <img src={lead.leadPhotoDataUrl} alt="" />
                ) : (
                  <span>{initials(lead)}</span>
                )}
              </div>
              <strong>{fullName(lead)}</strong>
            </button>
            <strong>{lead.phoneNumber}</strong>
            <strong>{lead.status || "new"}</strong>
            <button
              type="button"
              className={styles.deleteButton}
              aria-label={`Delete ${fullName(lead)}`}
              onClick={() => setLeadToDelete(lead)}
            >
              <Trash2 size={19} />
            </button>
          </article>
        ))}

        {!isLoading && filteredLeads.length === 0 ? (
          <div className={styles.emptyState}>No leads match this search yet.</div>
        ) : null}
      </section>

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
                  <input type="file" accept="image/*" onChange={handleLeadPhotoChange} />
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
                    <input
                      value={editorForm.firstName}
                      onBlur={() => setEditorForm((current) => ({ ...current, firstName: current.firstName.trim() }))}
                      onChange={(event) => setEditorForm((current) => ({ ...current, firstName: event.target.value }))}
                      placeholder="First name"
                    />
                  </label>

                  <label className={crmStyles.field}>
                    <span>Middle name</span>
                    <input
                      value={editorForm.middleName}
                      onBlur={() => setEditorForm((current) => ({ ...current, middleName: current.middleName?.trim() }))}
                      onChange={(event) => setEditorForm((current) => ({ ...current, middleName: event.target.value }))}
                      placeholder="Middle name"
                    />
                  </label>

                  <label className={crmStyles.field}>
                    <span>Last name</span>
                    <input
                      value={editorForm.lastName}
                      onBlur={() => setEditorForm((current) => ({ ...current, lastName: current.lastName.trim() }))}
                      onChange={(event) => setEditorForm((current) => ({ ...current, lastName: event.target.value }))}
                      placeholder="Last name"
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
                    <span>Lead source</span>
                    <select
                      value={editorForm.source}
                      onChange={(event) => setEditorForm((current) => ({ ...current, source: event.target.value }))}
                    >
                      <option>Users</option>
                      <option>Referral</option>
                      <option>Walk-in</option>
                      <option>Website</option>
                      <option>Phone call</option>
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
                    <input
                      value={editorForm.phoneNumber}
                      onBlur={() => setEditorForm((current) => ({ ...current, phoneNumber: current.phoneNumber.trim() }))}
                      onChange={(event) => setEditorForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                      placeholder="(000) 000-0000"
                    />
                  </label>

                  <label className={crmStyles.field}>
                    <span>Email</span>
                    <input
                      type="email"
                      value={editorForm.email}
                      onBlur={() => setEditorForm((current) => ({ ...current, email: current.email?.trim() }))}
                      onChange={(event) => setEditorForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="client@email.com"
                    />
                  </label>

                  <label className={crmStyles.fieldFull}>
                    <span>Address</span>
                    <AddressAutocomplete
                      value={editorForm.address ?? ""}
                      onBlur={() => setEditorForm((current) => ({ ...current, address: current.address?.trim() }))}
                      onChange={(address) => setEditorForm((current) => ({ ...current, address }))}
                      placeholder="Address"
                    />
                  </label>
                </div>
              </section>

              <LeadResources
                leadId={selectedLead.id}
                companies={editorCompanies}
                files={editorFiles}
                onCompaniesChange={setEditorCompanies}
                onFilesChange={setEditorFiles}
              />

              <section className={crmStyles.intakeSectionStack}>
                <h3>Task log</h3>
                <div className={crmStyles.taskLogPreview}>
                  <span>Task Name</span>
                  <span>Start Date</span>
                  <span>Modified Date</span>
                  <span>Status</span>
                </div>
              </section>

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
