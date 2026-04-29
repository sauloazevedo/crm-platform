"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy } from "lucide-react";
import styles from "./crm-shell.module.css";
import { AddressAutocomplete } from "./address-autocomplete";
import { useAuth } from "../contexts/AuthContext";
import { LeadResources } from "./lead-resources";
import {
  createLead as createLeadRequest,
  createLeadCompany,
  createLeadFile,
  getTaskBoard,
  type LeadCompanyRecord,
  type LeadFileRecord,
  type TaskBoardLane,
} from "../lib/crm-api";
import { compressImageFile } from "../lib/image-compression";

const emptyForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  createdAt: "",
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

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return value;
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function CrmShell() {
  const auth = useAuth();
  const [taskLanes, setTaskLanes] = useState<TaskBoardLane[]>([]);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState(emptyForm);
  const [leadCompanies, setLeadCompanies] = useState<LeadCompanyRecord[]>([]);
  const [leadFiles, setLeadFiles] = useState<Array<LeadFileRecord & { fileDataBase64?: string }>>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [photoFeedback, setPhotoFeedback] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTaskBoard() {
      if (!auth.isAuthenticated) {
        return;
      }

      try {
        const response = await getTaskBoard();

        if (isMounted) {
          setTaskLanes(response.lanes);
        }
      } catch (error) {
        console.warn("[crm-shell] failed to load task board summary:", error);

        if (isMounted) {
          setTaskLanes([]);
        }
      }
    }

    void loadTaskBoard();

    return () => {
      isMounted = false;
    };
  }, [auth.isAuthenticated]);

  const laneSummaries = useMemo(
    () =>
      taskLanes.map((lane) => ({
        stage: lane.title,
        count: lane.tasks.length,
      })),
    [taskLanes]
  );

  const openTaskChart = useMemo(() => {
    const counts = new Map<string, number>();

    for (const lane of taskLanes) {
      for (const task of lane.tasks) {
        const isDoneLane = lane.title.trim().toLowerCase() === "done";
        const isDoneTask = task.status === "done";

        if (isDoneLane || isDoneTask) {
          continue;
        }

        const key = task.title.trim() || "Untitled service";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const items = Array.from(counts.entries())
      .map(([title, count]) => ({ title, count }))
      .sort((left, right) => right.count - left.count || left.title.localeCompare(right.title))
      .slice(0, 8);

    const maxCount = items.reduce((highest, item) => Math.max(highest, item.count), 1);

    return { items, maxCount };
  }, [taskLanes]);

  function openLeadModal() {
    setLeadForm((current) => ({ ...current, createdAt: current.createdAt || getTodayDate() }));
    setIsLeadModalOpen(true);
  }

  function closeLeadModal() {
    setIsLeadModalOpen(false);
    setLeadForm({ ...emptyForm, createdAt: getTodayDate() });
    setLeadCompanies([]);
    setLeadFiles([]);
  }

  async function createLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!leadForm.firstName.trim() || !leadForm.lastName.trim()) {
      return;
    }

    try {
      const response = await createLeadRequest({
        firstName: leadForm.firstName.trim(),
        middleName: leadForm.middleName.trim(),
        lastName: leadForm.lastName.trim(),
        createdAt: leadForm.createdAt.trim() || undefined,
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

      setLeadForm((current) => ({ ...current, leadPhotoDataUrl: compressed.dataUrl }));
      setPhotoFeedback(`Lead photo ready (${Math.ceil(compressed.size / 1024)} KB).`);
      event.target.value = "";
    } catch (error) {
      console.warn("[crm-shell] failed to compress lead photo:", error);
      setPhotoFeedback("We could not compress this photo under 300 KB.");
      event.target.value = "";
    }
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
              Tasks
            </Link>
            <button type="button" onClick={openLeadModal}>
              New lead
            </button>
          </div>
        </header>

        {laneSummaries.length > 0 ? (
          <section className={styles.overviewSection}>
            <div className={styles.pipelineSection}>
              {laneSummaries.map((item) => (
                <article key={item.stage} className={styles.pipelineCard}>
                  <span>{item.stage}</span>
                  <strong>{item.count}</strong>
                </article>
              ))}
            </div>

            <article className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <div>
                  <p className={styles.eyebrow}>Open services</p>
                  <h2>Tasks by service</h2>
                </div>
                <span>{openTaskChart.items.reduce((total, item) => total + item.count, 0)} open tasks</span>
              </div>

              {openTaskChart.items.length > 0 ? (
                <div className={styles.chartBars}>
                  {openTaskChart.items.map((item, index) => (
                    <div key={`${item.title}-${index}`} className={styles.chartBarItem}>
                      <div className={styles.chartBarValue}>{item.count}</div>
                      <div className={styles.chartBarTrack}>
                        <div
                          className={styles.chartBarFill}
                          style={{ height: `${Math.max((item.count / openTaskChart.maxCount) * 100, 14)}%` }}
                        />
                      </div>
                      <div className={styles.chartBarLabel} title={item.title}>
                        {item.title}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.copy}>No open tasks yet. As soon as the team creates active tasks, this chart will show the service mix.</p>
              )}
            </article>
          </section>
        ) : null}

        {feedbackMessage ? <p className={styles.copy}>{feedbackMessage}</p> : null}
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
                  <input type="file" accept="image/jpeg,image/png" onChange={handleLeadPhotoChange} />
                  {leadForm.leadPhotoDataUrl ? (
                    <img src={leadForm.leadPhotoDataUrl} alt="Lead preview" />
                  ) : (
                    <span>{leadForm.firstName.slice(0, 1) || "L"}</span>
                  )}
                  <small>{photoFeedback ?? "Click to add photo"} JPG/PNG, max 300 KB.</small>
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
                    <span>Created date</span>
                    <input
                      type="date"
                      value={leadForm.createdAt}
                      onChange={(event) =>
                        setLeadForm((current) => ({ ...current, createdAt: event.target.value }))
                      }
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
                    <AddressAutocomplete
                      value={leadForm.address}
                      onBlur={() => setLeadForm((current) => ({ ...current, address: current.address.trim() }))}
                      onChange={(address) => setLeadForm((current) => ({ ...current, address }))}
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
