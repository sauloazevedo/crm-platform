export type AmplifyAuthRuntimeConfig = {
  userPoolId: string;
  userPoolClientId: string;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function getAmplifyAuthRuntimeConfig(): AmplifyAuthRuntimeConfig | null {
  const userPoolId = readEnv("NEXT_PUBLIC_COGNITO_USER_POOL_ID");
  const userPoolClientId = readEnv("NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID");

  if (!userPoolId || !userPoolClientId) {
    return null;
  }

  return {
    userPoolId,
    userPoolClientId,
  };
}

export function getCognitoRegion(userPoolId: string): string {
  const region = userPoolId.split("_")[0];

  if (!region) {
    throw new Error(`Unable to derive Cognito region from user pool id: ${userPoolId}`);
  }

  return region;
}
