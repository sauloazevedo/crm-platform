"use client";

import { useMemo, useState } from "react";
import { Printer, X } from "lucide-react";
import type { LeadCompanyRecord, LeadRecord } from "../lib/crm-api";
import styles from "./engagement-letter-modal.module.css";

type EntityType = "individual" | "single_member_llc" | "c_corporation" | "partnership" | "s_corporation" | "nonresident_alien";

type Props = {
  lead: LeadRecord;
  companies: LeadCompanyRecord[];
  currentUserName?: string;
  onClose: () => void;
};

const managers = [
  "SAULO AZEVEDO DE SOUZA",
  "PRISCILA SARDINHA MARINHO SOUZA",
] as const;

const entityOptions: Array<{ value: EntityType; label: string }> = [
  { value: "individual", label: "Individual (Form 1040)" },
  { value: "single_member_llc", label: "Single-Member LLC" },
  { value: "c_corporation", label: "C Corporation (Form 1120)" },
  { value: "partnership", label: "Partnership (Form 1065)" },
  { value: "s_corporation", label: "S Corporation (Form 1120-S)" },
  { value: "nonresident_alien", label: "Nonresident Alien (Form 1040-NR)" },
];

function fullName(lead: LeadRecord) {
  return [lead.firstName, lead.middleName, lead.lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function entityFromCompany(company?: LeadCompanyRecord): EntityType {
  const value = company?.entityType?.toLowerCase() ?? "";

  if (value.includes("s corporation") || value.includes("s-corp")) return "s_corporation";
  if (value.includes("c corporation") || value.includes("c-corp") || value.includes(" inc.")) return "c_corporation";
  if (value.includes("partnership")) return "partnership";
  if (value.includes("llc")) return "single_member_llc";
  return "c_corporation";
}

function managerFromUser(name?: string) {
  const normalized = name?.toLowerCase() ?? "";
  return normalized.includes("priscila") ? managers[1] : managers[0];
}

function formatLetterDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function buildPdfFileName(type: "Business" | "Individual", taxYear: string, subjectName: string) {
  const safeSubjectName = subjectName
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase() || "CLIENT";
  return `Engagement Letter_${type} Tax ${taxYear || "Year"}_${safeSubjectName}.pdf`;
}

export function EngagementLetterModal({ lead, companies, currentUserName, onClose }: Props) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "individual");
  const [entityType, setEntityType] = useState<EntityType>(() => entityFromCompany(companies[0]));
  const [taxYear, setTaxYear] = useState(String(lead.taxYear ?? new Date().getFullYear() - 1));
  const [manager, setManager] = useState<(typeof managers)[number]>(() => managerFromUser(currentUserName));

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === companyId),
    [companies, companyId]
  );
  const isBusinessLetter = companyId !== "individual" && Boolean(selectedCompany);
  const clientName = fullName(lead) || "CLIENT NAME";
  const engagementName = isBusinessLetter ? selectedCompany?.companyName?.trim() || "BUSINESS NAME" : clientName;
  const date = formatLetterDate(new Date());
  const pdfFileName = buildPdfFileName(isBusinessLetter ? "Business" : "Individual", taxYear, engagementName);

  function chooseRecipient(nextCompanyId: string) {
    setCompanyId(nextCompanyId);
    setEntityType(nextCompanyId === "individual" ? "individual" : entityFromCompany(companies.find((company) => company.id === nextCompanyId)));
  }

  function saveAsPdf() {
    const originalTitle = document.title;
    document.title = pdfFileName;
    window.print();
    document.title = originalTitle;
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <section className={styles.modal} onClick={(event) => event.stopPropagation()} aria-label="Engagement letter">
        <header className={styles.header}>
          <div>
            <p>ENGAGEMENT LETTER</p>
            <h2>Prepare for signature</h2>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close engagement letter">
            <X size={20} />
          </button>
        </header>

        <div className={styles.workspace}>
          <aside className={styles.settings}>
            <label>
              <span>Letter for</span>
              <select value={companyId} onChange={(event) => chooseRecipient(event.target.value)}>
                <option value="individual">{clientName} — Individual</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.companyName || "Unnamed company"}
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend>Entity type</legend>
              {entityOptions.map((option) => (
                <label key={option.value} className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={entityType === option.value}
                    onChange={() => setEntityType(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>

            <label>
              <span>Tax year</span>
              <input
                type="number"
                min="2000"
                max="2100"
                value={taxYear}
                onChange={(event) => setTaxYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </label>

            <label>
              <span>Prepared by</span>
              <select value={manager} onChange={(event) => setManager(event.target.value as (typeof managers)[number])}>
                {managers.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <p className={styles.settingsNote}>The client, company, and entity information are filled from this lead&apos;s CRM record.</p>
            <button type="button" className={styles.printButton} onClick={() => window.print()}>
              <Printer size={18} /> Print engagement letter
            </button>
            <button type="button" className={styles.pdfButton} onClick={saveAsPdf}>
              <Printer size={18} /> Save as PDF
            </button>
          </aside>

          <div className={styles.previewWrap}>
            <article className={styles.letter}>
              <header className={styles.letterHeader}>
                <img className={styles.logo} src="/smart-tax-returns.png" alt="Smart Tax Returns" />
                <h1>ENGAGEMENT LETTER</h1>
                <p>For Income Tax Preparation Services</p>
              </header>

              <section className={styles.firmInfo}>
                <h2>Firm Information</h2>
                <strong>SMART TAX RETURNS LLC</strong>
                <span>atendimento@smartaxreturns.com &nbsp;|&nbsp; (227) 245-1111</span>
                <span>IRS Certified Acceptance Agent (CAA)</span>
              </section>

              <section className={styles.clientInfo}>
                <h2>Client Information</h2>
                <p><strong>Client Name:</strong> {clientName} {isBusinessLetter ? <><strong>Business Name (if applicable):</strong> {engagementName}</> : null}</p>
                <div className={styles.entityList}>
                  {entityOptions.map((option) => (
                    <span key={option.value}>({entityType === option.value ? "X" : " "}) {option.label}</span>
                  ))}
                </div>
                <p><strong>Tax Year:</strong> {taxYear || "____"}</p>
                <p><strong>Date:</strong> {date}</p>
              </section>

              <section className={styles.terms}>
                <h2>Scope of Services</h2>
                <p>The client is engaging the tax preparer named above to prepare and submit the applicable federal and, if necessary, state income tax return(s) for the tax year listed. This engagement covers the preparation and filing of the tax return(s) only. It does not include audit services, verification, or advisory services, unless separately agreed to in writing.</p>

                <h2>Responsibility for Information</h2>
                <p>The client affirms that all information provided is complete, truthful, and accurate.</p>
                <p>The client acknowledges that they are solely responsible for the accuracy and completeness of all data provided, including all income received and dependents claimed.</p>
                <p>The client certifies that they have proper documentation to support all items reported, such as receipts, bank statements, income, and expense records.</p>
                <p>The preparer shall not be held responsible for omissions, errors, incomplete, incorrect, fraudulent, or omitted information, even if unintentional, nor for penalties, interest, or audits resulting from such information.</p>

                <h2>Deadlines and Submission of Documents</h2>
                <p>The client agrees to submit all required documents with reasonable time before the filing deadline. The preparer is not responsible for delays in filing caused by late submission of documentation.</p>

                <h2>Amendments After Filing</h2>
                <p>If an amended return is required due to client error or omission, an additional fee will be charged for this separate service.</p>

                <h2>Limitation of Professional Liability</h2>
                <p>The preparer&apos;s liability is limited to the amount paid by the client for the preparation of the tax return(s) under this agreement. Under no circumstances shall the preparer be liable for indirect damages, consequential losses, or lost profits resulting from the services rendered.</p>

                <h2>Communication with the IRS and Tax Authorities</h2>
                <p>This agreement does not include representation before the IRS or state agencies, nor does it include responses to letters, audits, or notices received after the tax return is filed. Any such support must be contracted separately.</p>

                <h2>Payment</h2>
                <p>Payment must be completed{isBusinessLetter ? "" : " via Stripe"} before the tax return is electronically filed or a final copy is delivered to the client. Fees are based on the complexity of the return and the time required for preparation.</p>

                <h2>e-File Authorization</h2>
                <p>By signing below, the client authorizes tax preparer {manager} to electronically submit the tax return(s) to the IRS and, if applicable, to state authorities, following the client&apos;s review and approval of the final draft.</p>

                <h2>Confirmation and Acceptance</h2>
                <p>By signing below, the client affirms that they have read, understood, and accepted the terms of this engagement letter and acknowledge full responsibility for the accuracy of the information provided.</p>

                <h2>Service Location &amp; Jurisdiction</h2>
                <p>All services are provided remotely by SMART TAX RETURNS LLC from the State of Florida. This agreement is governed by the laws of Florida, where all tax preparation and data processing occur.</p>
              </section>

              <section className={styles.signatures}>
                <div>
                  <strong>For {isBusinessLetter ? `${engagementName}:` : "Taxpayer:"}</strong>
                  <div className={styles.signatureLine} />
                  {isBusinessLetter ? <p>By {clientName}, President</p> : <p>{clientName}</p>}
                  <p>Date: __________</p>
                </div>
                <div>
                  <strong>For SMART TAX RETURNS LLC:</strong>
                  <div className={styles.signatureLine} />
                  <p>By {manager}, Manager</p>
                  <p>Date: __________</p>
                </div>
              </section>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}
