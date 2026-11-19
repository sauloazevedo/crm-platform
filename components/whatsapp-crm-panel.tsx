"use client";

import { useEffect, useState } from "react";
import { ExternalLink, LoaderCircle, Plus, UserRound } from "lucide-react";
import { getLeads, type LeadRecord } from "../lib/crm-api";
import styles from "./whatsapp-crm-panel.module.css";

function fullName(lead: LeadRecord) {
  return [lead.firstName, lead.middleName, lead.lastName].filter(Boolean).join(" ") || "Lead sem nome";
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export function WhatsAppCrmPanel({ phone, onLeadChange }: { phone: string; onLeadChange?: (lead: LeadRecord | null) => void }) {
  const [lead, setLead] = useState<LeadRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setLead(null);
    window.dispatchEvent(new CustomEvent("whatsapp-lead-change", { detail: null }));
    void getLeads({ limit: 20, offset: 0, search: normalizePhone(phone) })
      .then((response) => {
        if (!active) return;
        const digits = normalizePhone(phone);
        const match = response.leads.find((item) => normalizePhone(item.phoneNumber || "").includes(digits) || digits.includes(normalizePhone(item.phoneNumber || ""))) || response.leads[0] || null;
        setLead(match);
        onLeadChange?.(match);
        window.dispatchEvent(new CustomEvent("whatsapp-lead-change", { detail: { id: match?.id || null, name: match ? fullName(match) : null } }));
      })
      .catch(() => { if (active) { setError("Não foi possível consultar os leads agora."); onLeadChange?.(null); window.dispatchEvent(new CustomEvent("whatsapp-lead-change", { detail: null })); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [phone, onLeadChange]);

  function openLeadProfile() {
    if (!lead) return;
    window.open(`/leads?leadId=${encodeURIComponent(lead.id)}`, "_blank", "noopener,noreferrer");
  }

  function openNewLead() {
    window.open(`/leads?new=1&phone=${encodeURIComponent(phone)}`, "_blank", "noopener,noreferrer");
  }

  return <section className={styles.panel}>
    <div className={styles.header}><div><h3>CRM</h3><p>Vincule esta conversa ao cadastro do lead.</p></div><UserRound size={16} /></div>
    {loading ? <p className={styles.status}><LoaderCircle size={14} className={styles.spin} /> Procurando telefone…</p> : null}
    {error ? <p className={styles.error}>{error}</p> : null}
    {!loading && !error && lead ? <div className={styles.leadCard}><div className={styles.avatar}>{lead.leadPhotoDataUrl ? <img src={lead.leadPhotoDataUrl} alt="" /> : <UserRound size={16} />}</div><div className={styles.identity}><strong>{fullName(lead)}</strong><span>{lead.email || lead.phoneNumber}</span></div><button type="button" onClick={openLeadProfile} title="Abrir Lead Profile"><ExternalLink size={15} /></button></div> : null}
    {!loading && !error && !lead ? <div className={styles.empty}><p>Nenhum lead encontrado para este telefone.</p><button type="button" onClick={openNewLead}><Plus size={15} /> New Lead</button></div> : null}
  </section>;
}

