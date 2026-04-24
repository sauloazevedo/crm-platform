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
  leadPhotoDataUrl?: string;
  dateOfBirth?: string;
  taxId?: string;
  taxIdLast4?: string;
  gender?: string;
  phoneNumber: string;
  email?: string;
  address?: string;
  source?: string;
  serviceInterest?: string;
  preferredLanguage?: string;
  taxYear?: number;
  notes?: string;
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
  gender?: string | null;
  phoneNumber: string;
  email?: string | null;
  address?: string | null;
  source?: string | null;
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
  notes: string;
  leadId?: string | null;
  leadName?: string | null;
  status?: "in_progress" | "done";
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

export type InviteWorkspaceUserInput = {
  email: string;
  role?: string;
};

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

export async function getLeads(): Promise<{ leads: LeadRecord[] }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  const response = await fetch(`${getApiBaseUrl()}/leads`, {
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
    throw new Error(`Failed to create lead: ${response.status}`);
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
    throw new Error(`Failed to update lead: ${response.status}`);
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

  const response = await fetch(`${getApiBaseUrl()}/task-board`, {
    method: "PUT",
    headers: headers ?? { "Content-Type": "application/json" },
    body: JSON.stringify({ lanes }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save task board: ${response.status}`);
  }

  return response.json();
}
