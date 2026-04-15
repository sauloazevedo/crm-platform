"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, FileText, Plus, Trash2 } from "lucide-react";
import {
  createLeadCompany,
  createLeadFile,
  deleteLeadCompany,
  deleteLeadFile,
  updateLeadCompany,
  updateLeadFile,
  type LeadCompanyInput,
  type LeadCompanyRecord,
  type LeadFileRecord,
} from "../lib/crm-api";
import styles from "./crm-shell.module.css";

const entityTypeOptions = [
  "PARTNERSHIP",
  "LLC (LIMITED LIABILITY COMPANY)",
  "S CORPORATION (S-CORP)",
  "C CORPORATION (C-CORP OR INC.)",
  "NONPROFIT ORGANIZATION",
  "OTHER",
];

const businessTypeOptions = [
  "Construction",
  "Real estate",
  "Rental & leasing",
  "Manufacturing",
  "Transportation & warehousing",
  "Finance & Insurance",
  "Health care & social assistance",
  "Accommodation & food service",
  "Wholesale-agent/broker",
  "Wholesale-other",
  "Retail",
  "Other",
];

const emptyCompany: LeadCompanyInput = {
  companyName: "",
  ein: "",
  filingDate: "",
  principalAddress: "",
  mailingAddress: "",
  entityType: entityTypeOptions[0],
  businessType: businessTypeOptions[0],
  otherDescription: "",
  partners: {},
};

type DraftFile = LeadFileRecord & {
  fileDataBase64?: string;
};

type Props = {
  leadId?: string;
  companies: LeadCompanyRecord[];
  files: DraftFile[];
  onCompaniesChange: (companies: LeadCompanyRecord[]) => void;
  onFilesChange: (files: DraftFile[]) => void;
};

function formatDate(value?: string | null) {
  return value ? String(value).slice(0, 10) : "";
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Pending upload";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getPartnerValues(partners?: Record<string, string> | string[] | null) {
  if (Array.isArray(partners)) {
    return partners;
  }

  return Object.values(partners ?? {});
}

function addPartnerValue(partners: Record<string, string> | string[] | undefined, partner: string) {
  const values = [...getPartnerValues(partners), partner.trim()].filter(Boolean);

  return values.reduce<Record<string, string>>((acc, value, index) => {
    acc[`partner_${index + 1}`] = value;
    return acc;
  }, {});
}

function removePartnerValue(partners: Record<string, string> | string[] | undefined, partnerIndex: number) {
  return getPartnerValues(partners)
    .filter((_, index) => index !== partnerIndex)
    .reduce<Record<string, string>>((acc, value, index) => {
      acc[`partner_${index + 1}`] = value;
      return acc;
    }, {});
}

async function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result.split(",")[1] ?? "" : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function LeadResources({ leadId, companies, files, onCompaniesChange, onFilesChange }: Props) {
  const [resourceMessage, setResourceMessage] = useState<string | null>(null);
  const [partnerDrafts, setPartnerDrafts] = useState<Record<string, string>>({});
  const [collapsedCompanies, setCollapsedCompanies] = useState<Record<string, boolean>>({});

  async function addCompany() {
    setResourceMessage(null);
    const draft = { ...emptyCompany, companyName: "New company" };

    if (!leadId) {
      onCompaniesChange([
        { ...draft, id: `draft-${crypto.randomUUID()}`, leadId: "draft", createdAt: new Date().toISOString() },
        ...companies,
      ]);
      return;
    }

    try {
      const response = await createLeadCompany(leadId, draft);
      onCompaniesChange([response.company, ...companies]);
    } catch (error) {
      console.warn("[LeadResources] failed to create company:", error);
      setResourceMessage("We could not create this company yet. Please try again.");
    }
  }

  async function updateCompany(companyId: string, patch: Partial<LeadCompanyInput>) {
    setResourceMessage(null);
    const nextCompanies = companies.map((company) =>
      company.id === companyId ? { ...company, ...patch } : company
    );
    onCompaniesChange(nextCompanies);

    if (!leadId || companyId.startsWith("draft-")) {
      return;
    }

    const nextCompany = nextCompanies.find((company) => company.id === companyId);

    if (!nextCompany) {
      return;
    }

    try {
      const response = await updateLeadCompany(leadId, companyId, nextCompany);
      onCompaniesChange(nextCompanies.map((company) => (company.id === companyId ? response.company : company)));
    } catch (error) {
      console.warn("[LeadResources] failed to update company:", error);
      setResourceMessage("We could not save the company update yet.");
    }
  }

  async function removeCompany(companyId: string) {
    setResourceMessage(null);
    onCompaniesChange(companies.filter((company) => company.id !== companyId));

    if (leadId && !companyId.startsWith("draft-")) {
      try {
        await deleteLeadCompany(leadId, companyId);
      } catch (error) {
        console.warn("[LeadResources] failed to delete company:", error);
        setResourceMessage("We could not delete this company yet.");
      }
    }
  }

  async function copyCompanyAddress(address?: string) {
    if (address) {
      await navigator.clipboard.writeText(address);
    }
  }

  async function addPartner(companyId: string) {
    const partner = partnerDrafts[companyId]?.trim();

    if (!partner) {
      return;
    }

    const company = companies.find((item) => item.id === companyId);

    if (!company) {
      return;
    }

    setPartnerDrafts((current) => ({ ...current, [companyId]: "" }));
    await updateCompany(companyId, {
      partners: addPartnerValue(company.partners, partner),
    });
  }

  async function removePartner(companyId: string, partnerIndex: number) {
    const company = companies.find((item) => item.id === companyId);

    if (!company) {
      return;
    }

    await updateCompany(companyId, {
      partners: removePartnerValue(company.partners, partnerIndex),
    });
  }

  function toggleCompany(companyId: string) {
    setCollapsedCompanies((current) => ({ ...current, [companyId]: !current[companyId] }));
  }

  async function addFile(event: React.ChangeEvent<HTMLInputElement>) {
    setResourceMessage(null);
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const fileDataBase64 = await fileToBase64(file);
    const draftName = file.name.replace(/\.[^.]+$/, "") || file.name;

    if (!leadId) {
      onFilesChange([
        {
          id: `draft-${crypto.randomUUID()}`,
          leadId: "draft",
          fileName: draftName,
          originalFileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          fileDataBase64,
        },
        ...files,
      ]);
      event.target.value = "";
      return;
    }

    try {
      const response = await createLeadFile(leadId, {
        fileName: draftName,
        originalFileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        fileDataBase64,
      });

      onFilesChange([response.file, ...files]);
      event.target.value = "";
    } catch (error) {
      console.warn("[LeadResources] failed to upload file:", error);
      setResourceMessage("We could not upload this file yet.");
    }
  }

  async function renameFile(fileId: string, fileName: string) {
    setResourceMessage(null);
    const nextFiles = files.map((file) => (file.id === fileId ? { ...file, fileName } : file));
    onFilesChange(nextFiles);

    if (leadId && !fileId.startsWith("draft-")) {
      try {
        const response = await updateLeadFile(leadId, fileId, { fileName });
        onFilesChange(nextFiles.map((file) => (file.id === fileId ? response.file : file)));
      } catch (error) {
        console.warn("[LeadResources] failed to rename file:", error);
        setResourceMessage("We could not rename this file yet.");
      }
    }
  }

  async function removeFile(fileId: string) {
    setResourceMessage(null);
    onFilesChange(files.filter((file) => file.id !== fileId));

    if (leadId && !fileId.startsWith("draft-")) {
      try {
        await deleteLeadFile(leadId, fileId);
      } catch (error) {
        console.warn("[LeadResources] failed to delete file:", error);
        setResourceMessage("We could not delete this file yet.");
      }
    }
  }

  return (
    <>
      <section className={styles.intakeSectionStack}>
        <div className={styles.sectionTitleRow}>
          <h3>Company</h3>
          <button type="button" onClick={addCompany} aria-label="Add company">
            <Plus size={19} />
          </button>
        </div>
        {resourceMessage ? <p className={styles.resourceMessage}>{resourceMessage}</p> : null}

        <div className={styles.companyStack}>
          {companies.map((company) => (
            <article key={company.id} className={styles.companyCard}>
              <div className={styles.companyHeader}>
                <button
                  type="button"
                  className={styles.companyToggleButton}
                  onClick={() => toggleCompany(company.id)}
                  aria-label={collapsedCompanies[company.id] ? "Open company details" : "Close company details"}
                >
                  {collapsedCompanies[company.id] ? <ChevronRight size={19} /> : <ChevronDown size={19} />}
                </button>
                <input
                  value={company.companyName}
                  onBlur={(event) => updateCompany(company.id, { companyName: event.target.value.trim() || "New company" })}
                  onChange={(event) => onCompaniesChange(companies.map((item) => item.id === company.id ? { ...item, companyName: event.target.value } : item))}
                  placeholder="Company"
                />
                <button type="button" onClick={() => removeCompany(company.id)} aria-label="Delete company">
                  <Trash2 size={18} />
                </button>
              </div>

              {!collapsedCompanies[company.id] ? (
                <>
                  <div className={styles.companyGrid}>
                    <label>
                      <span>EIN</span>
                      <input value={company.ein ?? ""} onChange={(event) => updateCompany(company.id, { ein: event.target.value })} placeholder="EIN" />
                    </label>
                    <label>
                      <span>Filing Date</span>
                      <input type="date" value={formatDate(company.filingDate)} onChange={(event) => updateCompany(company.id, { filingDate: event.target.value })} />
                    </label>
                    <label>
                      <span>Company</span>
                      <input value={company.companyName} onChange={(event) => updateCompany(company.id, { companyName: event.target.value })} placeholder="Company" />
                    </label>
                    <label className={styles.companyFull}>
                      <span>Principal Address</span>
                      <div className={styles.copyInputWrap}>
                        <input value={company.principalAddress ?? ""} onChange={(event) => updateCompany(company.id, { principalAddress: event.target.value })} placeholder="Principal Address" />
                        <button type="button" onClick={() => copyCompanyAddress(company.principalAddress)} aria-label="Copy principal address">
                          <Copy size={17} />
                        </button>
                      </div>
                    </label>
                    <label className={styles.companyFull}>
                      <span>Mailing Address</span>
                      <div className={styles.copyInputWrap}>
                        <input value={company.mailingAddress ?? ""} onChange={(event) => updateCompany(company.id, { mailingAddress: event.target.value })} placeholder="Mailing Address" />
                        <button type="button" onClick={() => copyCompanyAddress(company.mailingAddress)} aria-label="Copy mailing address">
                          <Copy size={17} />
                        </button>
                      </div>
                    </label>
                    <label>
                      <span>Type of Entity</span>
                      <select value={company.entityType ?? entityTypeOptions[0]} onChange={(event) => updateCompany(company.id, { entityType: event.target.value })}>
                        {entityTypeOptions.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Business Type</span>
                      <select value={company.businessType ?? businessTypeOptions[0]} onChange={(event) => updateCompany(company.id, { businessType: event.target.value })}>
                        {businessTypeOptions.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Other (Specify)</span>
                      <input value={company.otherDescription ?? ""} onChange={(event) => updateCompany(company.id, { otherDescription: event.target.value })} placeholder="Other" />
                    </label>
                  </div>

                  <div className={styles.partnersBlock}>
                    <h4>Partners</h4>
                    <div className={styles.partnerInputRow}>
                      <input
                        value={partnerDrafts[company.id] ?? ""}
                        onBlur={(event) =>
                          setPartnerDrafts((current) => ({ ...current, [company.id]: event.target.value.trim() }))
                        }
                        onChange={(event) =>
                          setPartnerDrafts((current) => ({ ...current, [company.id]: event.target.value }))
                        }
                        placeholder="Select clients"
                      />
                      <button type="button" onClick={() => addPartner(company.id)}>
                        Add
                      </button>
                    </div>
                    {getPartnerValues(company.partners).map((partner, index) => (
                      <span key={`${partner}-${index}`}>
                        {partner}
                        <button type="button" onClick={() => removePartner(company.id, index)} aria-label={`Remove ${partner}`}>
                          <Trash2 size={15} />
                        </button>
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
            </article>
          ))}

          {companies.length === 0 ? <p className={styles.fileHint}>No companies attached yet.</p> : null}
        </div>
      </section>

      <section className={styles.intakeSectionStack}>
        <h3>Uploaded files</h3>
        <div className={styles.filePreview}>
          <label className={styles.uploadButton}>
            Click to upload a file
            <input type="file" onChange={addFile} />
          </label>
          <button type="button" aria-label="File upload helper">
            <FileText size={17} />
            Add
          </button>
        </div>

        <p className={styles.fileHint}>Files List ({files.length})</p>
        <div className={styles.filesList}>
          {files.map((file) => (
            <div key={file.id} className={styles.fileRow}>
              <input
                value={file.fileName}
                onBlur={(event) => renameFile(file.id, event.target.value.trim() || file.originalFileName || "Uploaded file")}
                onChange={(event) => onFilesChange(files.map((item) => item.id === file.id ? { ...item, fileName: event.target.value } : item))}
                aria-label="File name"
              />
              <span>{formatDateTime(file.uploadedAt)}</span>
              <button type="button" onClick={() => removeFile(file.id)} aria-label="Delete file">
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
