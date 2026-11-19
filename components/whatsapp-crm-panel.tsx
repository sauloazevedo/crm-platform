"use client";

import { useEffect, useState } from "react";
import { ExternalLink, LoaderCircle, Plus, Save, UserRound, X } from "lucide-react";
import { createLead, getLeads, updateLead, type CreateLeadInput, type LeadRecord } from "../lib/crm-api";
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
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateLeadInput>({ firstName: "", lastName: "", phoneNumber: phone, email: "", situation: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
    setForm({ firstName: lead.firstName || "", middleName: lead.middleName || "", lastName: lead.lastName || "", phoneNumber: lead.phoneNumber || phone, email: lead.email || "", situation: lead.situation || "", notes: lead.notes || "" });
    setSaveError(null);
    setModalOpen(true);
  }

  function openNewLead() {
    setForm({ firstName: "", lastName: "", phoneNumber: phone, email: "", situation: "", notes: "" });
    setSaveError(null);
    setModalOpen(true);
  }

  async function saveLead(event: React.FormEvent) {
    event.preventDefault();
    if (!form.firstName?.trim() || !form.lastName?.trim() || !form.phoneNumber?.trim()) return;
    setSaving(true); setSaveError(null);
    try {
      const response = lead ? await updateLead(lead.id, form) : await createLead(form);
      const savedLead = response.lead;
      setLead(savedLead);
      onLeadChange?.(savedLead);
      window.dispatchEvent(new CustomEvent("whatsapp-lead-change", { detail: { id: savedLead.id, name: fullName(savedLead) } }));
      setModalOpen(false);
    } catch (saveLeadError) {
      setSaveError(saveLeadError instanceof Error ? saveLeadError.message : "Não foi possível salvar o lead.");
    } finally { setSaving(false); }
  }

  return <section className={styles.panel}>
    <div className={styles.header}><div><h3>CRM</h3><p>Vincule esta conversa ao cadastro do lead.</p></div><UserRound size={16} /></div>
    {loading ? <p className={styles.status}><LoaderCircle size={14} className={styles.spin} /> Procurando telefone…</p> : null}
    {error ? <p className={styles.error}>{error}</p> : null}
    {!loading && !error && lead ? <div className={styles.leadCard}><div className={styles.avatar}>{lead.leadPhotoDataUrl ? <img src={lead.leadPhotoDataUrl} alt="" /> : <UserRound size={16} />}</div><div className={styles.identity}><strong>{fullName(lead)}</strong><span>{lead.email || lead.phoneNumber}</span></div><button type="button" onClick={openLeadProfile} title="Abrir Lead Profile"><ExternalLink size={15} /></button></div> : null}
    {!loading && !error && !lead ? <div className={styles.empty}><p>Nenhum lead encontrado para este telefone.</p><button type="button" onClick={openNewLead}><Plus size={15} /> New Lead</button></div> : null}
    {modalOpen ? <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}><form className={styles.leadModal} onSubmit={saveLead} onClick={(event) => event.stopPropagation()}><div className={styles.modalHeader}><div><span className={styles.modalEyebrow}>CRM</span><h4>{lead ? "Lead Profile" : "New Lead"}</h4></div><button type="button" className={styles.modalClose} onClick={() => setModalOpen(false)} aria-label="Fechar popup"><X size={16} /></button></div><div className={styles.formGrid}><label><span>First name</span><input value={form.firstName || ""} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} required /></label><label><span>Last name</span><input value={form.lastName || ""} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} required /></label><label><span>Phone</span><input value={form.phoneNumber || ""} onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))} required /></label><label><span>Email</span><input type="email" value={form.email || ""} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label><label><span>Situation</span><input value={form.situation || ""} onChange={(event) => setForm((current) => ({ ...current, situation: event.target.value }))} placeholder="New client, returning client…" /></label><label className={styles.fullField}><span>Notes</span><textarea value={form.notes || ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={4} /></label></div>{saveError ? <p className={styles.error}>{saveError}</p> : null}<div className={styles.modalActions}><button type="button" onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" disabled={saving}><Save size={14} /> {saving ? "Saving…" : lead ? "Save changes" : "Create lead"}</button></div></form></div> : null}
  </section>;
}

