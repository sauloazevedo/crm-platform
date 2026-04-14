import { fetchAuthSession } from "aws-amplify/auth";

export type AuthHeaders = {
  Authorization?: string;
  "x-session-token": string;
};

export async function getAuthHeaders(
  options?: { includeJsonContentType?: boolean }
): Promise<(AuthHeaders & { "Content-Type"?: string }) | null> {
  const session = await fetchAuthSession();
  const idTokenPayload = session.tokens?.idToken?.payload;

  const sessionToken =
    typeof idTokenPayload?.["custom:session_token"] === "string"
      ? idTokenPayload["custom:session_token"]
      : undefined;
  const idToken = session.tokens?.idToken?.toString();
  const accessToken = session.tokens?.accessToken?.toString();

  if (!sessionToken) {
    return null;
  }

  return options?.includeJsonContentType
    ? {
        ...(idToken || accessToken
          ? { Authorization: `Bearer ${idToken ?? accessToken}` }
          : {}),
        "x-session-token": sessionToken,
        "Content-Type": "application/json",
      }
    : {
        ...(idToken || accessToken
          ? { Authorization: `Bearer ${idToken ?? accessToken}` }
          : {}),
        "x-session-token": sessionToken,
      };
}
