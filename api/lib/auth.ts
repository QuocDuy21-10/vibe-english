import { createRemoteJWKSet, jwtVerify } from "jose";
import firebaseConfig from "../../firebase-applet-config.json" with { type: "json" };

const FIREBASE_JWKS_URL = new URL(
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
);

const jwks = createRemoteJWKSet(FIREBASE_JWKS_URL);

export interface VerifiedAuthUser {
  uid: string;
  email?: string;
}

export function getFirebaseProjectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    firebaseConfig.projectId ||
    "gen-lang-client-0338054309"
  );
}

export async function verifyFirebaseIdToken(
  authHeader: string | undefined
): Promise<VerifiedAuthUser> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const token = authHeader.substring("Bearer ".length).trim();
  if (!token) {
    throw new Error("Empty bearer token");
  }

  const projectId = getFirebaseProjectId();

  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId
  });

  const uid = payload.sub || (payload.user_id as string);
  if (!uid) {
    throw new Error("Token payload missing subject identifier");
  }

  return {
    uid,
    email: payload.email as string | undefined
  };
}
