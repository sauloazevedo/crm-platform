import { getAuthHeaders } from "./authHeaders";

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
  phoneNumber: string;
  email?: string;
  source?: string;
  serviceInterest?: string;
  preferredLanguage?: string;
  taxYear?: number;
  notes?: string;
};

export type CurrentUserProfile = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
};

export async function getCurrentUserProfile(): Promise<{ user: CurrentUserProfile }> {
  const headers = await getAuthHeaders({ includeJsonContentType: true });

  if (!headers) {
    throw new Error("Missing authenticated user token.");
  }

  const response = await fetch(`${getApiBaseUrl()}/users/me`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch current user: ${response.status}`);
  }

  return response.json();
}

export async function getLeads() {
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
