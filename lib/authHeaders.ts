import { fetchAuthSession } from "aws-amplify/auth";

export type AuthHeaders = {
  Authorization?: string;
  "x-user-sub": string;
  "x-session-token": string;
};

export async function getAuthHeaders(
  options?: { includeJsonContentType?: boolean }
): Promise<(AuthHeaders & { "Content-Type"?: string }) | null> {
  const session = await fetchAuthSession();
  const idTokenPayload = session.tokens?.idToken?.payload;
  const accessTokenPayload = session.tokens?.accessToken?.payload;

  const sub =
    session.userSub ||
    (typeof idTokenPayload?.sub === "string" ? idTokenPayload.sub : undefined) ||
    (typeof accessTokenPayload?.sub === "string" ? accessTokenPayload.sub : undefined);

  const sessionToken =
    typeof idTokenPayload?.["custom:session_token"] === "string"
      ? idTokenPayload["custom:session_token"]
      : undefined;
  const idToken = session.tokens?.idToken?.toString();
  const accessToken = session.tokens?.accessToken?.toString();

  if (!sub || !sessionToken) {
    return null;
  }

  return options?.includeJsonContentType
    ? {
        ...(idToken || accessToken
          ? { Authorization: `Bearer ${idToken ?? accessToken}` }
          : {}),
        "x-user-sub": sub,
        "x-session-token": sessionToken,
        "Content-Type": "application/json",
      }
    : {
        ...(idToken || accessToken
          ? { Authorization: `Bearer ${idToken ?? accessToken}` }
          : {}),
        "x-user-sub": sub,
        "x-session-token": sessionToken,
      };
}
