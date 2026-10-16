import { createHash } from "node:crypto";
import { getVercelOidcToken } from "@vercel/oidc";
import {
  ExternalAccountClient,
  type BaseExternalAccountClient,
  type ExternalAccountClientOptions
} from "google-auth-library";
import { TestPushError, type OwnedNotificationDevice, type TestPushDependencies } from "./testPush";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 3;
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  timestampValue?: string;
};

type FirestoreDocument = {
  name: string;
  fields?: Record<string, FirestoreValue>;
  updateTime?: string;
};

type GoogleApiError = {
  response?: {
    status?: number;
    data?: {
      error?: {
        status?: string;
        details?: Array<{ errorCode?: string }>;
      };
    };
  };
};

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function asGoogleApiError(error: unknown): GoogleApiError {
  return typeof error === "object" && error !== null ? error as GoogleApiError : {};
}

function isNotFound(error: unknown): boolean {
  return asGoogleApiError(error).response?.status === 404;
}

function isTransactionConflict(error: unknown): boolean {
  const apiError = asGoogleApiError(error);
  return apiError.response?.status === 409
    || apiError.response?.data?.error?.status === "ABORTED";
}

function rateStateId(userId: string, installationId: string): string {
  return createHash("sha256").update(`${userId}:${installationId}`).digest("hex");
}

function documentUrl(projectId: string, databaseId: string, path: string): string {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}`
    + `/databases/${encodeURIComponent(databaseId)}/documents/${encodedPath}`;
}

function databaseUrl(projectId: string, databaseId: string): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}`
    + `/databases/${encodeURIComponent(databaseId)}/documents`;
}

async function createAuthClient(): Promise<BaseExternalAccountClient> {
  const provider = requiredEnvironment("GCP_WORKLOAD_IDENTITY_PROVIDER");
  const serviceAccount = requiredEnvironment("GCP_TEST_PUSH_SERVICE_ACCOUNT");
  const audience = requiredEnvironment("GCP_OIDC_AUDIENCE");
  const options: ExternalAccountClientOptions = {
    type: "external_account",
    audience: `//iam.googleapis.com/${provider}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url:
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/`
      + `${encodeURIComponent(serviceAccount)}:generateAccessToken`,
    scopes: [CLOUD_PLATFORM_SCOPE],
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken({ audience })
    }
  };
  const client = ExternalAccountClient.fromJSON(options);
  if (!client) throw new Error("Unable to create Google external account client");
  return client;
}

async function getDocument(
  authClient: BaseExternalAccountClient,
  url: string,
  transaction?: string
): Promise<FirestoreDocument | null> {
  try {
    const response = await authClient.request<FirestoreDocument>({
      url,
      method: "GET",
      params: transaction ? { transaction } : undefined
    });
    return response.data;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function parseDevice(
  document: FirestoreDocument | null,
  userId: string,
  installationId: string
): OwnedNotificationDevice | null {
  const storedUserId = document?.fields?.userId?.stringValue;
  const token = document?.fields?.token?.stringValue;
  if (!document || storedUserId !== userId || !token || !document.updateTime) return null;
  return { userId, installationId, token, updateTime: document.updateTime };
}

async function beginTransaction(
  authClient: BaseExternalAccountClient,
  baseUrl: string
): Promise<string> {
  const response = await authClient.request<{ transaction: string }>({
    url: `${baseUrl}:beginTransaction`,
    method: "POST",
    data: { options: { readWrite: {} } }
  });
  return response.data.transaction;
}

async function rollbackTransaction(
  authClient: BaseExternalAccountClient,
  baseUrl: string,
  transaction: string
): Promise<void> {
  await authClient.request({
    url: `${baseUrl}:rollback`,
    method: "POST",
    data: { transaction }
  });
}

async function consumeRateLimitTransaction(
  authClient: BaseExternalAccountClient,
  baseUrl: string,
  stateDocumentUrl: string,
  stateDocumentName: string,
  now: Date
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const transaction = await beginTransaction(authClient, baseUrl);
  const document = await getDocument(authClient, stateDocumentUrl, transaction);
  const storedStart = document?.fields?.windowStartedAt?.timestampValue;
  const parsedStart = storedStart ? new Date(storedStart) : null;
  const withinWindow = parsedStart
    && !Number.isNaN(parsedStart.getTime())
    && now.getTime() - parsedStart.getTime() < RATE_LIMIT_WINDOW_MS;
  const currentCount = withinWindow
    ? Number(document?.fields?.count?.integerValue ?? "0")
    : 0;
  if (withinWindow && currentCount >= RATE_LIMIT_MAX_ATTEMPTS) {
    await rollbackTransaction(authClient, baseUrl, transaction);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((RATE_LIMIT_WINDOW_MS - (now.getTime() - parsedStart.getTime())) / 1000)
      )
    };
  }

  const windowStartedAt = withinWindow && parsedStart ? parsedStart : now;
  await authClient.request({
    url: `${baseUrl}:commit`,
    method: "POST",
    data: {
      transaction,
      writes: [{
        update: {
          name: stateDocumentName,
          fields: {
            windowStartedAt: { timestampValue: windowStartedAt.toISOString() },
            count: { integerValue: String(currentCount + 1) },
            lastAttemptAt: { timestampValue: now.toISOString() }
          }
        },
        updateMask: { fieldPaths: ["windowStartedAt", "count", "lastAttemptAt"] }
      }]
    }
  });
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function createGoogleCloudTestPushDependencies(): Promise<TestPushDependencies> {
  const projectId = requiredEnvironment("GCP_PROJECT_ID");
  const databaseId = requiredEnvironment("FIRESTORE_DATABASE_ID");
  if (databaseId === "(default)") throw new Error("Named Firestore database is required");
  const authClient = await createAuthClient();
  const baseUrl = databaseUrl(projectId, databaseId);

  return {
    async getOwnedDevice(userId, installationId) {
      const document = await getDocument(
        authClient,
        documentUrl(projectId, databaseId, `notificationUsers/${userId}/devices/${installationId}`)
      );
      return parseDevice(document, userId, installationId);
    },

    async consumeRateLimit(userId, installationId, now) {
      const stateId = rateStateId(userId, installationId);
      const statePath = `notificationTestStates/${stateId}`;
      const stateUrl = documentUrl(projectId, databaseId, statePath);
      const stateName = `projects/${projectId}/databases/${databaseId}/documents/${statePath}`;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          return await consumeRateLimitTransaction(
            authClient,
            baseUrl,
            stateUrl,
            stateName,
            now
          );
        } catch (error) {
          if (!isTransactionConflict(error) || attempt === 4) throw error;
        }
      }
      throw new Error("Unable to commit rate limit transaction");
    },

    async sendMessage(input) {
      try {
        const response = await authClient.request<{ name: string }>({
          url: `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
          method: "POST",
          data: {
            message: {
              token: input.token,
              data: input.data,
              webpush: { headers: { Urgency: "normal" } }
            }
          }
        });
        return { messageId: response.data.name };
      } catch (error) {
        const details = asGoogleApiError(error).response?.data?.error?.details ?? [];
        const errorCode = details.find((detail) => detail.errorCode)?.errorCode;
        if (errorCode === "UNREGISTERED" || errorCode === "INVALID_ARGUMENT") {
          throw new TestPushError(
            "DEVICE_TOKEN_INVALID",
            410,
            "Đăng ký FCM của thiết bị không còn hợp lệ."
          );
        }
        throw new TestPushError(
          "FCM_REJECTED",
          502,
          "FCM không chấp nhận thông báo thử. Vui lòng thử lại."
        );
      }
    },

    async deleteDeviceIfUnchanged(device) {
      const url = documentUrl(
        projectId,
        databaseId,
        `notificationUsers/${device.userId}/devices/${device.installationId}`
      );
      try {
        await authClient.request({
          url,
          method: "DELETE",
          params: { "currentDocument.updateTime": device.updateTime }
        });
      } catch (error) {
        if (!isNotFound(error) && asGoogleApiError(error).response?.status !== 409) throw error;
      }
    },

    async recordAccepted(userId, installationId, acceptedAt) {
      const stateId = rateStateId(userId, installationId);
      const statePath = `notificationTestStates/${stateId}`;
      await authClient.request({
        url: `${baseUrl}:commit`,
        method: "POST",
        data: {
          writes: [{
            update: {
              name: `projects/${projectId}/databases/${databaseId}/documents/${statePath}`,
              fields: { lastAcceptedAt: { timestampValue: acceptedAt.toISOString() } }
            },
            updateMask: { fieldPaths: ["lastAcceptedAt"] }
          }]
        }
      });
    },

    logError(context, errorCode) {
      console.error(JSON.stringify({
        event: "notification-test-error",
        context,
        errorCode: errorCode ?? "unknown"
      }));
    }
  };
}
