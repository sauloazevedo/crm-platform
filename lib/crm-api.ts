import { getAuthHeaders } from "./authHeaders";

async function readApiError(response: Response, fallback: string) {
  const errorBody = await response.json().catch(() => null);
  return errorBody?.message || fallback;
}

function getApiBaseUrl(): string {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!apiBaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_API_BASE_URL environment variable.");
  }

  return apiBaseUrl.replace(/\/$/, "");
}

export type CreateLeadInput = {
  firstName: string;
  middleName?: string;
  lastName: string;
  createdAt?: string;
  leadPhotoDataUrl?: string;
  dateOfBirth?: string;
  taxId?: string;
  taxIdLast4?: string;
  spouseFirstName?: string;
  spouseLastName?: string;
  spouseDateOfBirth?: string;
  spouseTaxId?: string;
  spouseTaxIdLast4?: string;
  gender?: string;
  situation?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  source?: string;
  customerAcquisitionType?: string;
  customerAcquisitionName?: string;
  leadSourceId?: string;
  leadSourceName?: string;
  serviceInterest?: string;
  preferredLanguage?: string;
  taxYear?: number;
  notes?: string;
  companies?: LeadCompanyInput[];
};

export type UpdateLeadInput = CreateLeadInput;

export type LeadRecord = {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  leadPhotoDataUrl?: string | null;
  dateOfBirth?: string | null;
  taxId?: string | null;
  taxIdLast4?: string | null;
  spouseFirstName?: string | null;
  spouseLastName?: string | null;
  spouseDateOfBirth?: string | null;
  spouseTaxId?: string | null;
  spouseTaxIdLast4?: string | null;
  gender?: string | null;
  situation?: string | null;
  phoneNumber: string;
  email?: string | null;
  address?: string | null;
  source?: string | null;
  customerAcquisitionType?: string | null;
  customerAcquisitionName?: string | null;
  leadSourceId?: string | null;
  leadSourceName?: string | null;
  serviceInterest?: string | null;
  preferredLanguage?: string | null;
  taxYear?: number | null;
  status: string;
  ownerId?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type LeadCompanyInput = {
  companyName: string;
  ein?: string;
  filingDate?: string;
  principalAddress?: string;
  mailingAddress?: string;
  entityType?: string;
  businessType?: string;
  otherDescription?: string;
  partners?: Record<string, string>;
};

export type LeadCompanyRecord = LeadCompanyInput & {
  id: string;
  leadId: string;
  createdAt?: string;
  updatedAt?: string;
};

export type LeadFileInput = {
  fileName: string;
  originalFileName?: string;
  contentType?: string;
  fileSize?: number;
  fileDataBase64: string;
};

export type LeadFileRecord = {
  id: string;
  leadId: string;
  fileName: string;
  originalFileName?: string | null;
  contentType?: string | null;
  fileSize?: number | null;
  fileDataBase64?: string;
  uploadedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type LeadLogInput = {
  title: string;
  description?: string;
};

export type LeadLogRecord = LeadLogInput & {
  id: string;
  leadId: string;
  createdAt?: string;
  updatedAt?: string;
};

export type InvoiceStatus = "draft" | "pending" | "partial" | "paid" | "overdue" | "cancelled";
export type InstallmentStatus = "pending" | "paid" | "overdue";

export type LeadInstallmentInput = {
  amount: number;
  dueDate?: string;
  status?: InstallmentStatus;
  paidAt?: string;
  paymentMethod?: string;
  notes?: string;
};

export type LeadInstallmentRecord = LeadInstallmentInput & {
  id: string;
  invoiceId: string;
  leadId: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type LeadInvoiceInput = {
  title: string;
  amount: number;
  status?: InvoiceStatus;
  dueDate?: string;
  issuedAt?: string;
  notes?: string;
  sourceTaskIds?: string[];
};

export type LeadInvoiceRecord = LeadInvoiceInput & {
  id: string;
  leadId: string;
  workspaceId?: string | null;
  installments: LeadInstallmentRecord[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type TaskBoardTask = {
  id: string;
  title: string;
  createdAt?: string | null;
  notes: string;
  leadId?: string | null;
  leadName?: string | null;
  status?: "todo" | "in_progress" | "done";
  hidden?: boolean;
  walletItems?: Array<{
    id: string;
    description: string;
    cost: number;
    revenue: number;
  }>;
};

export type TaskBoardLane = {
  id: string;
  title: string;
  tasks: TaskBoardTask[];
};

export type CurrentUserProfile = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  workspaceId?: string | null;
};

export type UpdateCurrentUserProfileInput = {
  firstName: string;
  lastName: string;
};

export type CreateBlogPostInput = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  youtubeEmbedUrl: string;
  category?: string;
  image?: string;
  readingTime?: string;
  publishedAt?: string;
  published?: boolean;
  relatedServiceSlug?: string;
  keywords?: string[];
};

export type BlogPostRecord = CreateBlogPostInput & {
  createdAt: string;
  updatedAt: string;
  publicationStatus: "DRAFT" | "PUBLISHED";
};

export type InviteWorkspaceUserInput = {
  email: string;
  role?: string;
};

export type WorkspaceAccessUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  invitationStatus: string;
  invitedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  isCurrentUser?: boolean;
};

function normalizeTimestampInput(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const directDate = value.trim().slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(directDate)) {
    return directDate;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().slice(0, 10);
}

export async function getCurrentUserProfile(options?: {
  headers?: HeadersInit;
  signal?: AbortSignal;
}): Promise<{ user: CurrentUserProfile }> {
  const headers = options?.headers ?? await getAuthHeaders({ includeJsonContentType: true });

  if (!headers) {
    throw new Error("Missing authenticated user token.");
  }

  const response = await fetch(`${getApiBaseUrl()}/users/me`, {
    method: "GET",
    headers,
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch current user: ${response.status}`);
  }

  return response.json();
}

export async function updateCurrentUserProfile(
  input: UpdateCurrentUserProfileInput
): Promise<{ user: CurrentUserProfile }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  if (!headers) {
    throw new Error("Missing authenticated user token.");
  }

  const response = await fetch(`${getApiBaseUrl()}/users/me`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Failed to update current user: ${response.status}`);
  }

  return response.json();
}

export async function inviteWorkspaceUser(
  input: InviteWorkspaceUserInput
): Promise<{ invitation: { email: string; role: string; workspaceId: string }; message: string }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  if (!headers) {
    throw new Error("Missing authenticated user token.");
  }

  const response = await fetch(`${getApiBaseUrl()}/users/invite`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.message || `Failed to invite workspace user: ${response.status}`);
  }

  return response.json();
}

export async function getWorkspaceAccessUsers(): Promise<{ users: WorkspaceAccessUser[] }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  if (!headers) {
    throw new Error("Missing authenticated user token.");
  }

  const response = await fetch(`${getApiBaseUrl()}/users/workspace-access`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Failed to fetch workspace users: ${response.status}`));
  }

  return response.json();
}

export async function removeWorkspaceAccessUser(userId: string): Promise<{ id: string }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  if (!headers) {
    throw new Error("Missing authenticated user token.");
  }

  const response = await fetch(`${getApiBaseUrl()}/users/workspace-access/${userId}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Failed to remove workspace user: ${response.status}`));
  }

  return response.json();
}

export async function getLeads(options?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<{
  leads: LeadRecord[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });
  const params = new URLSearchParams();

  if (options?.limit) {
    params.set("limit", String(options.limit));
  }

  if (typeof options?.offset === "number") {
    params.set("offset", String(options.offset));
  }

  if (options?.search?.trim()) {
    // Send both names while API deployments are being rolled forward.
    // Different published stages currently recognize different contracts.
    const normalizedSearch = options.search.trim();
    params.set("q", normalizedSearch);
    params.set("search", normalizedSearch);
  }

  const query = params.toString();

  const response = await fetch(`${getApiBaseUrl()}/leads${query ? `?${query}` : ""}`, {
    method: "GET",
    headers: headers ?? { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch leads: ${response.status}`);
  }

  return response.json();
}

export async function createLead(input: CreateLeadInput) {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads`, {
    method: "POST",
    headers: headers ?? { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Failed to create lead: ${response.status}`));
  }

  return response.json();
}

export async function createBlogPost(input: CreateBlogPostInput): Promise<{ post: BlogPostRecord }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  if (!headers) {
    throw new Error("Missing authenticated user token.");
  }

  const response = await fetch(`${getApiBaseUrl()}/blog/posts`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Failed to save blog post: ${response.status}`));
  }

  return response.json();
}

export async function importLeadsCsv(input: {
  csvBase64: string;
  importYear: number;
  columnMapping?: {
    leadName: string;
    taskTitle: string;
    revenue: string;
    cost: string;
  };
}): Promise<{
  message: string;
  processedRows: number;
  createdLeads: number;
  createdTasks: number;
  updatedTasks: number;
}> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/import`, {
    method: "POST",
    headers: headers ?? { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Failed to import leads CSV: ${response.status}`));
  }

  return response.json();
}

export async function updateLead(id: string, input: UpdateLeadInput): Promise<{ lead: LeadRecord }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${id}`, {
    method: "PATCH",
    headers: headers ?? { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Failed to update lead: ${response.status}`));
  }

  return response.json();
}

export async function deleteLead(id: string): Promise<{ id: string }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${id}`, {
    method: "DELETE",
    headers: headers ?? { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete lead: ${response.status}`);
  }

  return response.json();
}

export async function getLeadCompanies(leadId: string): Promise<{ companies: LeadCompanyRecord[] }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${leadId}/companies`, {
    method: "GET",
    headers: headers ?? { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch lead companies: ${response.status}`);
  }

  return response.json();
}

export async function createLeadCompany(
  leadId: string,
  input: LeadCompanyInput
): Promise<{ company: LeadCompanyRecord }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${leadId}/companies`, {
    method: "POST",
    headers: headers ?? { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Failed to create lead company: ${response.status}`);
  }

  return response.json();
}

export async function updateLeadCompany(
  leadId: string,
  companyId: string,
  input: LeadCompanyInput
): Promise<{ company: LeadCompanyRecord }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${leadId}/companies/${companyId}`, {
    method: "PATCH",
    headers: headers ?? { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Failed to update lead company: ${response.status}`);
  }

  return response.json();
}

export async function deleteLeadCompany(leadId: string, companyId: string): Promise<{ id: string }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${leadId}/companies/${companyId}`, {
    method: "DELETE",
    headers: headers ?? { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete lead company: ${response.status}`);
  }

  return response.json();
}

export async function getLeadFiles(leadId: string): Promise<{ files: LeadFileRecord[] }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${leadId}/files`, {
    method: "GET",
    headers: headers ?? { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch lead files: ${response.status}`);
  }

  return response.json();
}

export async function getLeadFile(leadId: string, fileId: string): Promise<{ file: LeadFileRecord }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${leadId}/files/${fileId}`, {
    method: "GET",
    headers: headers ?? { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch lead file: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function createLeadFile(leadId: string, input: LeadFileInput): Promise<{ file: LeadFileRecord }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${leadId}/files`, {
    method: "POST",
    headers: headers ?? { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Failed to create lead file: ${response.status}`);
  }

  return response.json();
}

export async function updateLeadFile(
  leadId: string,
  fileId: string,
  input: { fileName: string }
): Promise<{ file: LeadFileRecord }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${leadId}/files/${fileId}`, {
    method: "PATCH",
    headers: headers ?? { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Failed to update lead file: ${response.status}`);
  }

  return response.json();
}

export async function deleteLeadFile(leadId: string, fileId: string): Promise<{ id: string }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${leadId}/files/${fileId}`, {
    method: "DELETE",
    headers: headers ?? { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete lead file: ${response.status}`);
  }

  return response.json();
}

export async function getLeadLogs(leadId: string): Promise<{ logs: LeadLogRecord[] }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${leadId}/logs`, {
    method: "GET",
    headers: headers ?? { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch lead logs: ${response.status}`);
  }

  return response.json();
}

export async function createLeadLog(leadId: string, input: LeadLogInput): Promise<{ log: LeadLogRecord }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${leadId}/logs`, {
    method: "POST",
    headers: headers ?? { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Failed to create lead log: ${response.status}`);
  }

  return response.json();
}

export async function updateLeadLog(
  leadId: string,
  logId: string,
  input: LeadLogInput
): Promise<{ log: LeadLogRecord }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${leadId}/logs/${logId}`, {
    method: "PATCH",
    headers: headers ?? { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Failed to update lead log: ${response.status}`);
  }

  return response.json();
}

export async function deleteLeadLog(leadId: string, logId: string): Promise<{ id: string }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${leadId}/logs/${logId}`, {
    method: "DELETE",
    headers: headers ?? { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete lead log: ${response.status}`);
  }

  return response.json();
}

export type WhatsAppMessage = {
  id: string;
  whatsappMessageId: string;
  direction: "inbound" | "outbound";
  senderType: "customer" | "ai" | "human" | "app";
  bodyText: string | null;
  mediaType: string | null;
  mediaId: string | null;
  messageType?: "image" | "sticker" | "video" | "audio" | "document" | null;
  mediaCaption?: string | null;
  status: string | null;
  createdAt: string;
};

export type WhatsAppConversation = {
  id: string;
  status: "open" | "pending_ai" | "pending_human" | "resolved";
  assignedTo: string | null;
  assignedName: string | null;
  lockedBy: "ai" | "human" | "app" | null;
  lockedAt: string | null;
  isPriority: boolean;
  isStarred: boolean;
  archivedAt: string | null;
  lastMessageAt: string | null;
  contact: {
    id: string;
    waId: string;
    name: string;
    phone: string;
  };
  lastMessage: string | null;
};

async function whatsappRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });
  if (!headers) throw new Error("Missing authenticated user token.");

  const response = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers: { ...headers, ...init?.headers } });
  if (!response.ok) throw new Error(await readApiError(response, `WhatsApp request failed: ${response.status}`));
  return response.json() as Promise<T>;
}

export function getWhatsAppConversations() {
  return whatsappRequest<{ conversations: WhatsAppConversation[] }>("/whatsapp/conversations");
}

export function waitWhatsAppConversationUpdates(since: string | null) {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return whatsappRequest<{ changed: boolean; lastMessageAt: string | null }>(`/whatsapp/updates${query}`);
}

export async function getWhatsAppMedia(messageId: string) {
  const headers = await getAuthHeaders({ includeJsonContentType: false });
  if (!headers) throw new Error("Missing authenticated user token.");
  const response = await fetch(`${getApiBaseUrl()}/atendimento/whatsapp/media/${encodeURIComponent(messageId)}`, { headers: { ...headers, Accept: "application/json" } });
  if (!response.ok) throw new Error(await readApiError(response, "Could not retrieve WhatsApp media."));
  const payload = await response.json() as { url?: string };
  if (!payload.url) throw new Error("WhatsApp media URL was not returned.");
  return payload.url;
}

export function getWhatsAppConversation(id: string) {
  return whatsappRequest<{ conversation: WhatsAppConversation; messages: WhatsAppMessage[] }>(`/whatsapp/conversations/${id}`);
}

export function sendWhatsAppMessage(id: string, body: string) {
  return whatsappRequest<{ message: WhatsAppMessage }>(`/whatsapp/conversations/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export type WhatsAppOutgoingMedia = {
  objectKey: string;
  mimeType: string;
  messageType: "image" | "video" | "audio" | "document";
  caption?: string;
};

export async function createWhatsAppMediaUpload(id: string, file: File) {
  const response = await whatsappRequest<{ uploadUrl: string; objectKey: string; expiresIn: number }>(`/whatsapp/conversations/${id}/media-upload`, {
    method: "POST",
    body: JSON.stringify({ media: { mimeType: file.type, size: file.size } }),
  });
  const upload = await fetch(response.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!upload.ok) throw new Error("Não foi possível enviar o arquivo para o armazenamento seguro.");
  return { objectKey: response.objectKey, mimeType: file.type };
}

export function sendWhatsAppMedia(id: string, media: WhatsAppOutgoingMedia) {
  return whatsappRequest<{ message: WhatsAppMessage }>(`/whatsapp/conversations/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ media }),
  });
}

export function claimWhatsAppConversation(id: string) {
  return whatsappRequest<{ conversation: WhatsAppConversation }>(`/whatsapp/conversations/${id}/claim`, { method: "POST" });
}

export function releaseWhatsAppConversationToAi(id: string) {
  return whatsappRequest<{ conversation: WhatsAppConversation }>(`/whatsapp/conversations/${id}/release-ai`, { method: "POST" });
}

export function resolveWhatsAppConversation(id: string) {
  return whatsappRequest<{ conversation: WhatsAppConversation }>(`/whatsapp/conversations/${id}/resolve`, { method: "POST" });
}

export function assignWhatsAppConversation(id: string, userId: string | null) {
  return whatsappRequest<{ conversation: WhatsAppConversation }>(`/whatsapp/conversations/${id}/assign`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export type WhatsAppQuickReply = { id: string; title: string; body: string; createdAt: string | null };

export function getWhatsAppQuickReplies() {
  return whatsappRequest<{ quickReplies: WhatsAppQuickReply[] }>("/whatsapp/quick-replies");
}

export function createWhatsAppQuickReply(title: string, body: string) {
  return whatsappRequest<{ quickReply: WhatsAppQuickReply }>("/whatsapp/quick-replies", {
    method: "POST",
    body: JSON.stringify({ title, body }),
  });
}

export function deleteWhatsAppQuickReply(id: string) {
  return whatsappRequest<{ deleted: boolean; id: string }>(`/whatsapp/quick-replies/${id}`, { method: "DELETE" });
}

export function toggleWhatsAppConversationPriority(id: string) {
  return whatsappRequest<{ conversation: WhatsAppConversation }>(`/whatsapp/conversations/${id}/priority`, { method: "POST" });
}

export function toggleWhatsAppConversationStar(id: string) {
  return whatsappRequest<{ conversation: WhatsAppConversation }>(`/whatsapp/conversations/${id}/star`, { method: "POST" });
}

export function toggleWhatsAppConversationArchive(id: string) {
  return whatsappRequest<{ conversation: WhatsAppConversation }>(`/whatsapp/conversations/${id}/archive`, { method: "POST" });
}

export function deleteWhatsAppConversation(id: string) {
  return whatsappRequest<{ deleted: boolean; conversationId: string }>(`/whatsapp/conversations/${id}`, { method: "DELETE" });
}

export async function getLeadInvoices(leadId: string): Promise<{ invoices: LeadInvoiceRecord[] }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${leadId}/invoices`, {
    method: "GET",
    headers: headers ?? { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch lead invoices: ${response.status}`);
  }

  return response.json();
}

export async function createLeadInvoice(
  leadId: string,
  input: LeadInvoiceInput
): Promise<{ invoice: LeadInvoiceRecord }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${leadId}/invoices`, {
    method: "POST",
    headers: headers ?? { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Failed to create lead invoice: ${response.status}`));
  }

  return response.json();
}

export async function updateLeadInvoice(
  leadId: string,
  invoiceId: string,
  input: LeadInvoiceInput
): Promise<{ invoice: LeadInvoiceRecord }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${leadId}/invoices/${invoiceId}`, {
    method: "PATCH",
    headers: headers ?? { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Failed to update lead invoice: ${response.status}`));
  }

  return response.json();
}

export async function deleteLeadInvoice(leadId: string, invoiceId: string): Promise<{ id: string }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${leadId}/invoices/${invoiceId}`, {
    method: "DELETE",
    headers: headers ?? { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Failed to delete lead invoice: ${response.status}`));
  }

  return response.json();
}

export async function createLeadInstallment(
  leadId: string,
  invoiceId: string,
  input: LeadInstallmentInput
): Promise<{ installment: LeadInstallmentRecord }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads/${leadId}/invoices/${invoiceId}/installments`, {
    method: "POST",
    headers: headers ?? { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Failed to create installment: ${response.status}`));
  }

  return response.json();
}

export async function updateLeadInstallment(
  leadId: string,
  invoiceId: string,
  installmentId: string,
  input: LeadInstallmentInput
): Promise<{ installment: LeadInstallmentRecord }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(
    `${getApiBaseUrl()}/leads/${leadId}/invoices/${invoiceId}/installments/${installmentId}`,
    {
      method: "PATCH",
      headers: headers ?? { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    throw new Error(await readApiError(response, `Failed to update installment: ${response.status}`));
  }

  return response.json();
}

export async function deleteLeadInstallment(
  leadId: string,
  invoiceId: string,
  installmentId: string
): Promise<{ id: string }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(
    `${getApiBaseUrl()}/leads/${leadId}/invoices/${invoiceId}/installments/${installmentId}`,
    {
      method: "DELETE",
      headers: headers ?? { "Content-Type": "application/json" },
    }
  );

  if (!response.ok) {
    throw new Error(await readApiError(response, `Failed to delete installment: ${response.status}`));
  }

  return response.json();
}

export async function getTaskBoard(): Promise<{ lanes: TaskBoardLane[] }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/task-board`, {
    method: "GET",
    headers: headers ?? { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch task board: ${response.status}`);
  }

  return response.json();
}

export async function saveTaskBoard(lanes: TaskBoardLane[]): Promise<{ lanes: TaskBoardLane[] }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });
  const normalizedLanes = lanes.map((lane) => ({
    ...lane,
    tasks: lane.tasks.map((task) => ({
      ...task,
      createdAt: normalizeTimestampInput(task.createdAt),
    })),
  }));

  const response = await fetch(`${getApiBaseUrl()}/task-board`, {
    method: "PUT",
    headers: headers ?? { "Content-Type": "application/json" },
    body: JSON.stringify({ lanes: normalizedLanes }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Failed to save task board: ${response.status}`));
  }

  return response.json();
}
