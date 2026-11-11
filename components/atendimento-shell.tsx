"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CheckCheck,
  ChevronLeft,
  Filter,
  Inbox,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  Settings,
  Sparkles,
  UserRound,
  Wifi,
} from "lucide-react";
import styles from "./atendimento-shell.module.css";

type Message = {
  id: string;
  text: string;
  time: string;
  direction: "inbound" | "outbound";
  automated?: boolean;
};

type Conversation = {
  id: string;
  name: string;
  phone: string;
  initials: string;
  color: string;
  lastMessage: string;
  lastTime: string;
  unread: number;
  assignedTo: string;
  status: "new" | "open" | "waiting";
  messages: Message[];
};

const initialConversations: Conversation[] = [
  {
    id: "ana",
    name: "Ana Martins",
    phone: "+1 (407) 555-0142",
    initials: "AM",
    color: "#f28322",
    lastMessage: "Posso enviar os documentos por aqui?",
    lastTime: "09:42",
    unread: 2,
    assignedTo: "Sofia",
    status: "open",
    messages: [
      { id: "ana-1", text: "Olá, preciso de ajuda para preparar meu tax return.", time: "09:36", direction: "inbound" },
      { id: "ana-2", text: "Olá, Ana! Sou a assistente virtual da Smart Tax Returns. Posso começar com algumas informações para direcionar seu atendimento?", time: "09:37", direction: "outbound", automated: true },
      { id: "ana-3", text: "Claro, pode ser.", time: "09:38", direction: "inbound" },
      { id: "ana-4", text: "Perfeito. Você vai declarar como pessoa física, empresa, ou os dois?", time: "09:39", direction: "outbound", automated: true },
      { id: "ana-5", text: "Pessoa física. Posso enviar os documentos por aqui?", time: "09:42", direction: "inbound" },
    ],
  },
  {
    id: "roberto",
    name: "Roberto Lima",
    phone: "+1 (321) 555-0186",
    initials: "RL",
    color: "#4bf2e2",
    lastMessage: "Obrigado! Vou verificar e retorno amanhã.",
    lastTime: "09:15",
    unread: 0,
    assignedTo: "Michael",
    status: "waiting",
    messages: [
      { id: "roberto-1", text: "Recebi sua proposta. Obrigado! Vou verificar e retorno amanhã.", time: "09:15", direction: "inbound" },
    ],
  },
  {
    id: "carla",
    name: "Carla Oliveira",
    phone: "+1 (689) 555-0121",
    initials: "CO",
    color: "#a78bfa",
    lastMessage: "Qual é o melhor horário para uma ligação?",
    lastTime: "Ontem",
    unread: 1,
    assignedTo: "Não atribuído",
    status: "new",
    messages: [
      { id: "carla-1", text: "Olá! Qual é o melhor horário para uma ligação?", time: "Ontem", direction: "inbound" },
    ],
  },
  {
    id: "thiago",
    name: "Thiago Sousa",
    phone: "+1 (407) 555-0179",
    initials: "TS",
    color: "#f25d27",
    lastMessage: "Documento recebido, muito obrigado.",
    lastTime: "Ontem",
    unread: 0,
    assignedTo: "Sofia",
    status: "open",
    messages: [
      { id: "thiago-1", text: "Documento recebido, muito obrigado.", time: "Ontem", direction: "inbound" },
    ],
  },
];

const statusLabels = {
  new: "Novo",
  open: "Em atendimento",
  waiting: "Aguardando",
};

export function AtendimentoShell() {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState("ana");
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState("");

  const activeConversation = conversations.find((conversation) => conversation.id === activeId) ?? conversations[0];
  const filteredConversations = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase();
    if (!query) return conversations;

    return conversations.filter((conversation) =>
      [conversation.name, conversation.phone, conversation.lastMessage]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query)
    );
  }, [conversations, searchTerm]);

  function selectConversation(id: string) {
    setActiveId(id);
    setConversations((current) => current.map((conversation) => (
      conversation.id === id ? { ...conversation, unread: 0 } : conversation
    )));
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;

    const now = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    const newMessage: Message = {
      id: `${activeId}-${Date.now()}`,
      text,
      time: now,
      direction: "outbound",
    };

    setConversations((current) => current.map((conversation) => (
      conversation.id === activeId
        ? { ...conversation, messages: [...conversation.messages, newMessage], lastMessage: text, lastTime: now, status: "open" }
        : conversation
    )));
    setDraft("");
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <Link href="/dashboard" className={styles.backLink}>
            <ChevronLeft size={16} aria-hidden="true" /> Dashboard
          </Link>
          <div>
            <p className={styles.eyebrow}>Central de conversas</p>
            <h1>Atendimento</h1>
          </div>
        </div>

        <div className={styles.headerActions}>
          <div className={styles.connectionStatus}>
            <span className={styles.connectionDot} aria-hidden="true" />
            <Wifi size={15} aria-hidden="true" />
            Canal preparado para conexão
          </div>
          <button type="button" className={styles.iconButton} aria-label="Configurar atendimento">
            <Settings size={18} />
          </button>
        </div>
      </header>

      <section className={styles.integrationNotice} aria-label="Status da integração">
        <div className={styles.noticeIcon}><Sparkles size={17} /></div>
        <div>
          <strong>Pronto para conectar ao WhatsApp Business</strong>
          <p>Esta central será conectada pela API oficial da Meta — mensagens e automações aparecerão aqui após a configuração.</p>
        </div>
        <button type="button" className={styles.setupButton}>Configurar canal</button>
      </section>

      <section className={styles.workspace} aria-label="Central de atendimento">
        <aside className={styles.inbox}>
          <div className={styles.inboxHeader}>
            <div>
              <p className={styles.eyebrow}>Caixa de entrada</p>
              <h2>Conversas</h2>
            </div>
            <span className={styles.countBadge}>{conversations.reduce((total, conversation) => total + conversation.unread, 0)}</span>
          </div>

          <label className={styles.searchBox}>
            <Search size={17} aria-hidden="true" />
            <span className={styles.srOnly}>Buscar conversa</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar conversas"
            />
          </label>

          <button type="button" className={styles.filterButton}>
            <Filter size={15} /> Todas as conversas <span>12</span>
          </button>

          <div className={styles.conversationList}>
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => selectConversation(conversation.id)}
                className={`${styles.conversationItem} ${activeId === conversation.id ? styles.conversationItemActive : ""}`}
              >
                <span className={styles.avatar} style={{ backgroundColor: conversation.color }}>{conversation.initials}</span>
                <span className={styles.conversationBody}>
                  <span className={styles.conversationTop}>
                    <strong>{conversation.name}</strong>
                    <time>{conversation.lastTime}</time>
                  </span>
                  <span className={styles.conversationBottom}>
                    <span>{conversation.lastMessage}</span>
                    {conversation.unread > 0 ? <b>{conversation.unread}</b> : null}
                  </span>
                </span>
              </button>
            ))}
            {filteredConversations.length === 0 ? <p className={styles.emptyState}>Nenhuma conversa encontrada.</p> : null}
          </div>
        </aside>

        <section className={styles.chat}>
          <header className={styles.chatHeader}>
            <div className={styles.contactInfo}>
              <span className={styles.avatar} style={{ backgroundColor: activeConversation.color }}>{activeConversation.initials}</span>
              <div>
                <h2>{activeConversation.name}</h2>
                <p>{activeConversation.phone} <span>•</span> {statusLabels[activeConversation.status]}</p>
              </div>
            </div>
            <div className={styles.chatActions}>
              <span className={styles.assignee}><UserRound size={14} /> {activeConversation.assignedTo}</span>
              <button type="button" className={styles.iconButton} aria-label="Mais ações"><MoreHorizontal size={20} /></button>
            </div>
          </header>

          <div className={styles.messages}>
            <p className={styles.dateLabel}>Hoje</p>
            {activeConversation.messages.map((message) => (
              <div key={message.id} className={`${styles.messageRow} ${message.direction === "outbound" ? styles.outbound : ""}`}>
                <div className={`${styles.message} ${message.direction === "outbound" ? styles.outboundMessage : ""}`}>
                  {message.automated ? <span className={styles.aiTag}><Bot size={12} /> IA</span> : null}
                  <p>{message.text}</p>
                  <span className={styles.messageMeta}>{message.time}{message.direction === "outbound" ? <CheckCheck size={14} aria-label="Enviado" /> : null}</span>
                </div>
              </div>
            ))}
          </div>

          <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
            <button type="button" className={styles.attachButton} aria-label="Anexar arquivo"><Paperclip size={19} /></button>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escreva uma mensagem" />
            <button type="submit" className={styles.sendButton} aria-label="Enviar mensagem"><Send size={18} /></button>
          </form>
        </section>

        <aside className={styles.details}>
          <div className={styles.detailsHeader}>
            <p className={styles.eyebrow}>Contexto do cliente</p>
            <button type="button" className={styles.iconButton} aria-label="Mais opções"><MoreHorizontal size={19} /></button>
          </div>

          <div className={styles.profileCard}>
            <span className={styles.profileAvatar} style={{ backgroundColor: activeConversation.color }}>{activeConversation.initials}</span>
            <h2>{activeConversation.name}</h2>
            <p>{activeConversation.phone}</p>
            <button type="button" className={styles.openLeadButton}>Abrir no CRM</button>
          </div>

          <div className={styles.detailSection}>
            <h3>Atendimento</h3>
            <dl>
              <div><dt>Status</dt><dd><span className={styles.statusPill}>{statusLabels[activeConversation.status]}</span></dd></div>
              <div><dt>Responsável</dt><dd>{activeConversation.assignedTo}</dd></div>
              <div><dt>Canal</dt><dd><MessageCircle size={14} /> WhatsApp</dd></div>
            </dl>
          </div>

          <div className={styles.aiCard}>
            <span><Bot size={18} /></span>
            <div>
              <strong>Assistente de IA ativo</strong>
              <p>A IA inicia o atendimento, coleta informações e passa a conversa para a equipe quando necessário.</p>
              <button type="button">Ver regras da IA</button>
            </div>
          </div>

          <div className={styles.detailSection}>
            <h3>Atalhos</h3>
            <button type="button" className={styles.shortcut}><Inbox size={16} /> Criar tarefa de follow-up</button>
            <button type="button" className={styles.shortcut}><UserRound size={16} /> Atribuir responsável</button>
          </div>
        </aside>
      </section>
    </main>
  );
}
