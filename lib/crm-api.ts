import { fetchAuthSession } from "aws-amplify/auth";

function getApiBaseUrl(): string {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!apiBaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_API_BASE_URL environment variable.");
  }

  return apiBaseUrl.replace(/\/$/, "");
}

async function buildHeaders() {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken;
  const accessToken = session.tokens?.accessToken?.toString();
  const idTokenString = idToken?.toString();
  const idTokenPayload = idToken?.payload as Record<string, unknown> | undefined;
  const sub = typeof idTokenPayload?.sub === "string" ? idTokenPayload.sub : undefined;
  const sessionToken =
    typeof idTokenPayload?.["custom:session_token"] === "string"
      ? idTokenPayload["custom:session_token"]
      : undefined;

  return {
    "Content-Type": "application/json",
    ...(idTokenString || accessToken
      ? { Authorization: `Bearer ${idTokenString ?? accessToken}` }
      : {}),
    ...(sub ? { "x-user-sub": sub } : {}),
    ...(sessionToken ? { "x-session-token": sessionToken } : {}),
  };
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

export async function getLeads() {
  const response = await fetch(`${getApiBaseUrl()}/leads`, {
    method: "GET",
    headers: await buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch leads: ${response.status}`);
  }

  return response.json();
}

export async function createLead(input: CreateLeadInput) {
  const response = await fetch(`${getApiBaseUrl()}/leads`, {
    method: "POST",
    headers: await buildHeaders(),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Failed to create lead: ${response.status}`);
  }

  return response.json();
}
