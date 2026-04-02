"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./crm-shell.module.css";

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
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState(emptyForm);

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

  function createLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!leadForm.firstName.trim() || !leadForm.lastName.trim() || !leadForm.phoneNumber.trim()) {
      return;
    }

    setLeads((current) => [
      {
        id: `lead-${crypto.randomUUID()}`,
        firstName: leadForm.firstName.trim(),
        middleName: leadForm.middleName.trim(),
        lastName: leadForm.lastName.trim(),
        phoneNumber: leadForm.phoneNumber.trim(),
        status: "New lead",
        owner: "Unassigned",
      },
      ...current,
    ]);

    closeLeadModal();
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
          </div>

          <div className={styles.actions}>
            <Link href="/dashboard">Back to dashboard</Link>
            <Link href="/crm/tasks" className={styles.toolsButton}>
              Open workflow board
            </Link>
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
              <span>{orderedLeads.length} records</span>
            </div>

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
