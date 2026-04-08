"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./crm-shell.module.css";
import { useAuth } from "../contexts/AuthContext";
import { LogoutButton } from "./auth/logout-button";
import { createLead as createLeadRequest, getLeads } from "../lib/crm-api";

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
  phoneNumber: string;
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
  phoneNumber: "",
};

export function CrmShell() {
  const auth = useAuth();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState(emptyForm);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

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
            phoneNumber: String(lead.phoneNumber ?? ""),
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
        phoneNumber: leadForm.phoneNumber.trim(),
      });

      const createdLead = response.lead as Record<string, unknown>;

      setLeads((current) => [
        {
          id: String(createdLead.id),
          firstName: String(createdLead.firstName ?? ""),
          middleName: String(createdLead.middleName ?? ""),
          lastName: String(createdLead.lastName ?? ""),
          phoneNumber: String(createdLead.phoneNumber ?? ""),
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
          <div
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
              <label className={styles.field}>
                <span>First name</span>
                <input
                  value={leadForm.firstName}
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
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, lastName: event.target.value }))
                  }
                  placeholder="Last name"
                />
              </label>

              <label className={styles.field}>
                <span>Phone number</span>
                <input
                  value={leadForm.phoneNumber}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, phoneNumber: event.target.value }))
                  }
                  placeholder="(000) 000-0000"
                />
              </label>

              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryModalButton} onClick={closeLeadModal}>
                  Cancel
                </button>
                <button type="submit" className={styles.primaryModalButton}>
                  Save lead
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
