"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, CheckCheck, ChevronLeft, CircleAlert, MessageCircle, RefreshCw, Send, UserRound } from "lucide-react";
import {
  claimWhatsAppConversation,
  getWhatsAppConversation,
  getWhatsAppConversations,
  getWhatsAppMedia,
  releaseWhatsAppConversationToAi,
  resolveWhatsAppConversation,
  sendWhatsAppMessage,
  type WhatsAppConversation,
  type WhatsAppMessage,
} from "../lib/crm-api";
import styles from "./whatsapp-inbox-shell.module.css";

const statusLabel: Record<WhatsAppConversation["status"], string> = {
  open: "Em atendimento",
  pending_ai: "IA disponível",
  pending_human: "Aguardando equipe",
  resolved: "Resolvida",
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "WA";
}

function formatTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function WhatsAppMedia({ message }: { message: WhatsAppMessage }) {
  const [src, setSrc] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (message.messageType !== "image" && message.messageType !== "sticker") return;
    let active = true;
    void getWhatsAppMedia(message.id)
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => { if (active) setUnavailable(true); });
    return () => {
      active = false;
    };
  }, [message.id, message.messageType]);

  if (unavailable) return <p>[imagem indisponível]</p>;
  if (!src) return <p>Carregando mídia…</p>;
  return <><img src={src} alt={message.mediaCaption || "Mídia recebida no WhatsApp"} /><p>{message.mediaCaption || null}</p></>;
}

export function WhatsAppInboxShell() {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [selected, setSelected] = useState<WhatsAppConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshingRef = useRef(false);

  async function loadConversations(preferredId?: string, silently = false) {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    if (!silently) setLoading(true);
    try {
      const response = await getWhatsAppConversations();
      setConversations(response.conversations);
      const next = response.conversations.find((conversation) => conversation.id === preferredId)
        ?? response.conversations.find((conversation) => conversation.id === selected?.id)
        ?? response.conversations[0]
        ?? null;
      if (next) await selectConversation(next);
      else {
        setSelected(null);
        setMessages([]);
      }
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as conversas.");
    } finally {
      refreshingRef.current = false;
      if (!silently) setLoading(false);
    }
  }

  async function selectConversation(conversation: WhatsAppConversation) {
    setSelected(conversation);
    try {
      const response = await getWhatsAppConversation(conversation.id);
      setSelected(response.conversation);
      setMessages(response.messages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a conversa.");
    }
  }

  useEffect(() => { void loadConversations(); }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadConversations(selected?.id, true);
      }
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [selected?.id]);

  async function updateConversation(action: "claim" | "release" | "resolve") {
    if (!selected) return;
    setWorking(true);
    try {
      const response = action === "claim"
        ? await claimWhatsAppConversation(selected.id)
        : action === "release"
          ? await releaseWhatsAppConversationToAi(selected.id)
          : await resolveWhatsAppConversation(selected.id);
      setSelected(response.conversation);
      setConversations((current) => current.map((conversation) => conversation.id === response.conversation.id ? response.conversation : conversation));
      setError(null);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Não foi possível atualizar a conversa.");
    } finally {
      setWorking(false);
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !draft.trim()) return;
    setWorking(true);
    try {
      const response = await sendWhatsAppMessage(selected.id, draft.trim());
      setMessages((current) => [...current, response.message]);
      setDraft("");
      await loadConversations(selected.id);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar a mensagem.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link href="/atendimento" className={styles.back}><ChevronLeft size={16} /> Atendimento</Link>
          <p className={styles.eyebrow}>WhatsApp Cloud API</p>
          <h1>Inbox do WhatsApp</h1>
        </div>
        <button type="button" onClick={() => void loadConversations()} className={styles.refresh} disabled={loading}>
          <RefreshCw size={16} /> Atualizar
        </button>
      </header>

      {error ? <p className={styles.error}><CircleAlert size={16} /> {error}</p> : null}

      <section className={styles.workspace}>
        <aside className={styles.list}>
          <div className={styles.listHeader}>
            <div><p className={styles.eyebrow}>Conversas</p><h2>Caixa de entrada</h2></div>
            <span>{conversations.length}</span>
          </div>
          {loading ? <p className={styles.placeholder}>Carregando conversas…</p> : null}
          {!loading && conversations.length === 0 ? <p className={styles.placeholder}>Ainda não há mensagens recebidas neste canal.</p> : null}
          <div className={styles.conversationList}>
            {conversations.map((conversation) => (
              <button key={conversation.id} type="button" onClick={() => void selectConversation(conversation)} className={`${styles.conversation} ${selected?.id === conversation.id ? styles.active : ""}`}>
                <span className={styles.avatar}>{initials(conversation.contact.name)}</span>
                <span className={styles.conversationText}>
                  <strong>{conversation.contact.name}</strong>
                  <span>{conversation.lastMessage || conversation.contact.phone}</span>
                </span>
                <time>{formatTime(conversation.lastMessageAt)}</time>
              </button>
            ))}
          </div>
        </aside>

        <section className={styles.chat}>
          {selected ? <>
            <header className={styles.chatHeader}>
              <div className={styles.contact}><span className={styles.avatar}>{initials(selected.contact.name)}</span><div><h2>{selected.contact.name}</h2><p>{selected.contact.phone} · {statusLabel[selected.status]}</p></div></div>
              <span className={styles.lock}>{selected.lockedBy === "ai" ? <><Bot size={14} /> IA</> : <><UserRound size={14} /> {selected.lockedBy === "app" ? "App do celular" : "Equipe"}</>}</span>
            </header>
            <div className={styles.messages}>
              {messages.map((message) => <div key={message.id} className={`${styles.row} ${message.direction === "outbound" ? styles.outbound : ""}`}>
                <article className={styles.message}>
                  {message.senderType === "app" ? <small>Enviada pelo App do celular</small> : null}
                  {message.messageType === "image" || message.messageType === "sticker"
                    ? <WhatsAppMedia message={message} />
                    : <p>{message.bodyText || `[${message.mediaType || "Mensagem"}]`}</p>}
                  <span>{formatTime(message.createdAt)} {message.direction === "outbound" ? <CheckCheck size={13} /> : null}</span>
                </article>
              </div>)}
            </div>
            <form onSubmit={send} className={styles.composer}>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escreva uma mensagem" disabled={working || selected.status === "resolved"} />
              <button type="submit" disabled={working || !draft.trim() || selected.status === "resolved"} aria-label="Enviar mensagem"><Send size={18} /></button>
            </form>
          </> : <div className={styles.emptyChat}><MessageCircle size={28} /><p>Selecione uma conversa para ver o histórico.</p></div>}
        </section>

        <aside className={styles.details}>
          {selected ? <>
            <p className={styles.eyebrow}>Atendimento</p>
            <h2>{selected.contact.name}</h2>
            <dl><div><dt>Status</dt><dd>{statusLabel[selected.status]}</dd></div><div><dt>Responsável</dt><dd>{selected.assignedName || "Não atribuído"}</dd></div><div><dt>Controle</dt><dd>{selected.lockedBy === "ai" ? "IA" : selected.lockedBy === "app" ? "App do celular" : "Humano"}</dd></div></dl>
            <div className={styles.actions}>
              <button type="button" onClick={() => void updateConversation("claim")} disabled={working || selected.status === "resolved"}>Assumir atendimento</button>
              <button type="button" onClick={() => void updateConversation("release")} disabled={working || selected.status === "resolved"}>Liberar para IA</button>
              <button type="button" onClick={() => void updateConversation("resolve")} disabled={working || selected.status === "resolved"}>Resolver conversa</button>
            </div>
            <p className={styles.aiNotice}><Bot size={16} /> A IA não envia mensagens nesta etapa. Quando o atendimento é humano ou pelo app, ela permanece bloqueada.</p>
          </> : null}
        </aside>
      </section>
    </main>
  );
}
