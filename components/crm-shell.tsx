"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy } from "lucide-react";
import styles from "./crm-shell.module.css";
import { useAuth } from "../contexts/AuthContext";
import { LogoutButton } from "./auth/logout-button";
import { LeadResources } from "./lead-resources";
import {
  createLead as createLeadRequest,
  createLeadCompany,
  createLeadFile,
  getLeads,
  type LeadCompanyRecord,
  type LeadFileRecord,
} from "../lib/crm-api";

const pipeline = [
  { stage: "New lead", count: 14 },
  { stage: "Consult scheduled", count: 8 },
  { stage: "Docs pending", count: 21 },
  { stage: "In preparation", count: 11 },
  { stage: "Review", count: 6 },
  { stage: "Ready to file", count: 9 },
];

type Lead = {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth?: string;
  taxId?: string;
  taxIdLast4?: string;
  gender?: string;
  phoneNumber: string;
  email?: string;
  address?: string;
  status: string;
  owner: string;
  notes?: string;
};

const initialLeads: Lead[] = [
  {
    id: "lead-1",
    firstName: "Maria",
    middleName: "",
    lastName: "Alvarez",
    phoneNumber: "(305) 555-0101",
    status: "Docs pending",
    owner: "Ana",
  },
  {
    id: "lead-2",
    firstName: "Jonathan",
    middleName: "",
    lastName: "Lee",
    phoneNumber: "(786) 555-0130",
    status: "Review",
    owner: "Chris",
  },
  {
    id: "lead-3",
    firstName: "Olivia",
    middleName: "Grace",
    lastName: "Santos",
    phoneNumber: "(954) 555-0124",
    status: "New lead",
    owner: "Unassigned",
  },
];

const emptyForm = {
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

export function CrmShell() {
  const auth = useAuth();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState(emptyForm);
  const [leadCompanies, setLeadCompanies] = useState<LeadCompanyRecord[]>([]);
  const [leadFiles, setLeadFiles] = useState<Array<LeadFileRecord & { fileDataBase64?: string }>>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [photoFeedback, setPhotoFeedback] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLeads() {
      if (!auth.isAuthenticated) {
        return;
      }

      try {
        const response = await getLeads();

        if (!isMounted) {
          return;
        }

        setLeads(
          (response.leads as Array<Record<string, unknown>>).map((lead) => ({
            id: String(lead.id),
            firstName: String(lead.firstName ?? ""),
            middleName: String(lead.middleName ?? ""),
            lastName: String(lead.lastName ?? ""),
            dateOfBirth: String(lead.dateOfBirth ?? ""),
            taxId: String(lead.taxId ?? ""),
            taxIdLast4: String(lead.taxIdLast4 ?? ""),
            gender: String(lead.gender ?? ""),
            phoneNumber: String(lead.phoneNumber ?? ""),
            email: String(lead.email ?? ""),
            address: String(lead.address ?? ""),
            status: String(lead.status ?? "New lead"),
            owner: String(lead.ownerId ?? "Unassigned"),
            notes: typeof lead.notes === "string" ? lead.notes : undefined,
          }))
        );
      } catch (error) {
        console.error("[crm-shell] failed to load leads:", error);

        if (isMounted) {
          setFeedbackMessage("We could not load live leads yet. Showing local preview data.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingLeads(false);
        }
      }
    }

    void loadLeads();

    return () => {
      isMounted = false;
    };
  }, [auth.isAuthenticated]);

  const orderedLeads = useMemo(
    () =>
      [...leads].sort((a, b) => {
        if (a.status === "New lead" && b.status !== "New lead") return -1;
        if (a.status !== "New lead" && b.status === "New lead") return 1;
        return a.lastName.localeCompare(b.lastName);
      }),
    [leads]
  );

  function fullName(lead: Lead) {
    return [lead.firstName, lead.middleName, lead.lastName].filter(Boolean).join(" ");
  }

  function openLeadModal() {
    setIsLeadModalOpen(true);
  }

  function closeLeadModal() {
    setIsLeadModalOpen(false);
    setLeadForm(emptyForm);
    setLeadCompanies([]);
    setLeadFiles([]);
  }

  async function createLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!leadForm.firstName.trim() || !leadForm.lastName.trim() || !leadForm.phoneNumber.trim()) {
      return;
    }

    try {
      const response = await createLeadRequest({
        firstName: leadForm.firstName.trim(),
        middleName: leadForm.middleName.trim(),
        lastName: leadForm.lastName.trim(),
        leadPhotoDataUrl: leadForm.leadPhotoDataUrl,
        dateOfBirth: leadForm.dateOfBirth.trim(),
        taxId: leadForm.taxId.trim(),
        gender: leadForm.gender.trim(),
        phoneNumber: leadForm.phoneNumber.trim(),
        email: leadForm.email.trim(),
        address: leadForm.address.trim(),
        source: leadForm.source.trim(),
        serviceInterest: leadForm.serviceInterest.trim(),
        preferredLanguage: leadForm.preferredLanguage.trim(),
        notes: leadForm.notes.trim(),
      });

      const createdLead = response.lead as Record<string, unknown>;
      const createdLeadId = String(createdLead.id);

      await Promise.all([
        ...leadCompanies.map((company) =>
          createLeadCompany(createdLeadId, {
            companyName: company.companyName,
            ein: company.ein ?? "",
            filingDate: company.filingDate ?? "",
            principalAddress: company.principalAddress ?? "",
            mailingAddress: company.mailingAddress ?? "",
            entityType: company.entityType ?? "",
            businessType: company.businessType ?? "",
            otherDescription: company.otherDescription ?? "",
            partners: company.partners ?? {},
          })
        ),
        ...leadFiles
          .filter((file) => file.fileDataBase64)
          .map((file) =>
            createLeadFile(createdLeadId, {
              fileName: file.fileName,
              originalFileName: file.originalFileName ?? "",
              contentType: file.contentType ?? "",
              fileSize: file.fileSize ?? undefined,
              fileDataBase64: file.fileDataBase64 ?? "",
            })
          ),
      ]);

      setLeads((current) => [
        {
          id: createdLeadId,
          firstName: String(createdLead.firstName ?? ""),
          middleName: String(createdLead.middleName ?? ""),
          lastName: String(createdLead.lastName ?? ""),
          leadPhotoDataUrl: String(createdLead.leadPhotoDataUrl ?? ""),
          dateOfBirth: String(createdLead.dateOfBirth ?? ""),
          taxId: String(createdLead.taxId ?? ""),
          taxIdLast4: String(createdLead.taxIdLast4 ?? ""),
          gender: String(createdLead.gender ?? ""),
          phoneNumber: String(createdLead.phoneNumber ?? ""),
          email: String(createdLead.email ?? ""),
          address: String(createdLead.address ?? ""),
          status: String(createdLead.status ?? "New lead"),
          owner: "Unassigned",
        },
        ...current,
      ]);

      setFeedbackMessage("Lead created successfully.");
      closeLeadModal();
    } catch (error) {
      console.error("[crm-shell] failed to create lead:", error);
      setFeedbackMessage("We could not save this lead in the API yet.");
    }
  }

  function formatTaxId(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    const first = digits.slice(0, 3);
    const second = digits.slice(3, 5);
    const third = digits.slice(5, 9);

    return [first, second, third].filter(Boolean).join("-");
  }

  async function copyTaxId() {
    if (!leadForm.taxId) {
      setCopyFeedback("Add a Tax ID before copying.");
      return;
    }

    try {
      await navigator.clipboard.writeText(leadForm.taxId);
      setCopyFeedback("Tax ID copied.");
    } catch (error) {
      console.warn("[crm-shell] failed to copy tax id:", error);
      setCopyFeedback("We could not copy the Tax ID.");
    }
  }

  function handleLeadPhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setPhotoFeedback("Choose an image file.");
      return;
    }

    if (file.size > 1_000_000) {
      setPhotoFeedback("Use an image smaller than 1 MB.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";

      setLeadForm((current) => ({ ...current, leadPhotoDataUrl: result }));
      setPhotoFeedback("Lead photo ready.");
    };

    reader.onerror = () => {
      setPhotoFeedback("We could not read this image.");
    };

    reader.readAsDataURL(file);
  }

  return (
    <>
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Client Operations</p>
            <h1>CRM</h1>
            <p className={styles.copy}>
              Track the tax workflow from first contact through filing readiness.
            </p>
            <p className={styles.copy}>
              Signed in as {auth.user?.email ?? auth.user?.firstName ?? "office user"}.
            </p>
          </div>

          <div className={styles.actions}>
            <Link href="/dashboard">Back to dashboard</Link>
            <Link href="/crm/tasks" className={styles.toolsButton}>
              Open workflow board
            </Link>
            <LogoutButton />
            <button type="button" onClick={openLeadModal}>
              New lead
            </button>
          </div>
        </header>

        <section className={styles.pipelineSection}>
          {pipeline.map((item) => (
            <article key={item.stage} className={styles.pipelineCard}>
              <span>{item.stage}</span>
              <strong>{item.count}</strong>
            </article>
          ))}
        </section>

        <section className={styles.workspace}>
          <div className={styles.listCard}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Lead Queue</h2>
                <p className={styles.cardSubtitle}>Recent inbound leads and priority follow-up.</p>
              </div>
              <span>{isLoadingLeads ? "Loading..." : `${orderedLeads.length} records`}</span>
            </div>

            {feedbackMessage ? <p className={styles.cardSubtitle}>{feedbackMessage}</p> : null}

            <div className={styles.table}>
              <div className={styles.tableHead}>
                <span>Lead</span>
                <span>Phone</span>
                <span>Status</span>
                <span>Owner</span>
              </div>

              {orderedLeads.map((lead) => (
                <div key={lead.id} className={styles.tableRow}>
                  <span>{fullName(lead)}</span>
                  <span>{lead.phoneNumber}</span>
                  <span>{lead.status}</span>
                  <span>{lead.owner}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className={styles.sidePanel}>
            <div className={styles.noteCard}>
              <span className={styles.noteEyebrow}>Lead intake</span>
              <strong>Open the modal to register a new lead with name and phone in a clean intake flow.</strong>
              <p>Every new lead enters the queue immediately with default ownership and a fresh workflow status.</p>
            </div>

            <div className={styles.noteCard}>
              <span className={styles.noteEyebrow}>Next build</span>
              <strong>Lead conversion, task board, and engagement timeline.</strong>
              <p>
                The workflow board is now available from this CRM page so the team can manage
                lanes and operational tasks in a Trello-style view.
              </p>
            </div>
          </aside>
        </section>
      </main>

      {isLeadModalOpen ? (
        <div className={styles.modalOverlay} onClick={closeLeadModal}>
          <aside
            className={styles.modalCard}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-lead-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalEyebrow}>New Lead</p>
                <h2 id="new-lead-title">Add a new lead</h2>
              </div>
              <button type="button" className={styles.modalCloseButton} onClick={closeLeadModal}>
                Close
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={createLead}>
              <section className={styles.intakeSection}>
                <label className={styles.avatarPreview}>
                  <input type="file" accept="image/*" onChange={handleLeadPhotoChange} />
                  {leadForm.leadPhotoDataUrl ? (
                    <img src={leadForm.leadPhotoDataUrl} alt="Lead preview" />
                  ) : (
                    <span>{leadForm.firstName.slice(0, 1) || "L"}</span>
                  )}
                  <small>{photoFeedback ?? "Click to add photo"}</small>
                </label>

                <div className={styles.intakeGrid}>
                  <label className={styles.field}>
                    <span>First name</span>
                    <input
                      value={leadForm.firstName}
                      onBlur={() =>
                        setLeadForm((current) => ({ ...current, firstName: current.firstName.trim() }))
                      }
                      onChange={(event) =>
                        setLeadForm((current) => ({ ...current, firstName: event.target.value }))
                      }
                      placeholder="First name"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Middle name</span>
                    <input
                      value={leadForm.middleName}
                      onBlur={() =>
                        setLeadForm((current) => ({ ...current, middleName: current.middleName.trim() }))
                      }
                      onChange={(event) =>
                        setLeadForm((current) => ({ ...current, middleName: event.target.value }))
                      }
                      placeholder="Middle name"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Last name</span>
                    <input
                      value={leadForm.lastName}
                      onBlur={() =>
                        setLeadForm((current) => ({ ...current, lastName: current.lastName.trim() }))
                      }
                      onChange={(event) =>
                        setLeadForm((current) => ({ ...current, lastName: event.target.value }))
                      }
                      placeholder="Last name"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Date of birth</span>
                    <input
                      type="date"
                      value={leadForm.dateOfBirth}
                      onChange={(event) =>
                        setLeadForm((current) => ({ ...current, dateOfBirth: event.target.value }))
                      }
                    />
                  </label>

                  <div className={styles.field}>
                    <span>Tax ID</span>
                    <div className={styles.copyInputWrap}>
                      <input
                        inputMode="numeric"
                        maxLength={11}
                        value={leadForm.taxId}
                        onChange={(event) =>
                          setLeadForm((current) => ({
                            ...current,
                            taxId: formatTaxId(event.target.value),
                          }))
                        }
                        placeholder="xxx-xx-xxxx"
                      />
                      <button type="button" onClick={copyTaxId} aria-label="Copy Tax ID">
                        <Copy size={17} />
                      </button>
                    </div>
                    {copyFeedback ? <small className={styles.copyFeedback}>{copyFeedback}</small> : null}
                  </div>

                  <label className={styles.field}>
                    <span>Lead source</span>
                    <select
                      value={leadForm.source}
                      onChange={(event) =>
                        setLeadForm((current) => ({ ...current, source: event.target.value }))
                      }
                    >
                      <option>Users</option>
                      <option>Referral</option>
                      <option>Walk-in</option>
                      <option>Website</option>
                      <option>Phone call</option>
                    </select>
                  </label>

                  <label className={styles.fieldWide}>
                    <span>Gender</span>
                    <select
                      value={leadForm.gender}
                      onChange={(event) =>
                        setLeadForm((current) => ({ ...current, gender: event.target.value }))
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

              <section className={styles.intakeSectionStack}>
                <h3>Contact</h3>
                <div className={styles.contactGrid}>
                  <label className={styles.field}>
                    <span>Phone number</span>
                    <input
                      value={leadForm.phoneNumber}
                      onBlur={() =>
                        setLeadForm((current) => ({ ...current, phoneNumber: current.phoneNumber.trim() }))
                      }
                      onChange={(event) =>
                        setLeadForm((current) => ({ ...current, phoneNumber: event.target.value }))
                      }
                      placeholder="(000) 000-0000"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Email</span>
                    <input
                      type="email"
                      value={leadForm.email}
                      onBlur={() => setLeadForm((current) => ({ ...current, email: current.email.trim() }))}
                      onChange={(event) =>
                        setLeadForm((current) => ({ ...current, email: event.target.value }))
                      }
                      placeholder="client@email.com"
                    />
                  </label>

                  <label className={styles.fieldFull}>
                    <span>Address</span>
                    <input
                      value={leadForm.address}
                      onBlur={() => setLeadForm((current) => ({ ...current, address: current.address.trim() }))}
                      onChange={(event) =>
                        setLeadForm((current) => ({ ...current, address: event.target.value }))
                      }
                      placeholder="Address"
                    />
                  </label>
                </div>
              </section>

              <LeadResources
                companies={leadCompanies}
                files={leadFiles}
                onCompaniesChange={setLeadCompanies}
                onFilesChange={setLeadFiles}
              />

              <section className={styles.intakeSectionStack}>
                <h3>Task log</h3>
                <div className={styles.taskLogPreview}>
                  <span>Task Name</span>
                  <span>Start Date</span>
                  <span>Modified Date</span>
                  <span>Status</span>
                </div>
              </section>

              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryModalButton} onClick={closeLeadModal}>
                  Cancel
                </button>
                <button type="submit" className={styles.primaryModalButton}>
                  Save lead
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}
