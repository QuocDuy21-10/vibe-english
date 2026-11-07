import type { VercelResponse } from "@vercel/node";
import {
  createGoogleCloudAiQuotaConsumer,
  type FixedWindowPolicy,
  type RateLimitResult
} from "./googleCloud.js";

export const AI_QUOTA_POLICY: FixedWindowPolicy = { windowMs: 60 * 60 * 1000, limit: 300 };

export async function consumeAiQuota(
  userId: string,
  cost: number,
  now: Date = new Date()
): Promise<RateLimitResult> {
  // Local `npm run dev` has no Vercel OIDC token to reach GCP; on Vercel, failures propagate (fail closed).
  if (!process.env.VERCEL) return { allowed: true, retryAfterSeconds: 0 };
  const consume = await createGoogleCloudAiQuotaConsumer(AI_QUOTA_POLICY);
  return consume(userId, cost, now);
}

/** Charges `cost` words to the user's hourly AI quota; on rejection writes the response and returns false. */
export async function enforceAiQuota(
  res: VercelResponse,
  userId: string,
  cost: number
): Promise<boolean> {
  let quota: RateLimitResult;
  try {
    quota = await consumeAiQuota(userId, cost);
  } catch (error) {
    console.error("AI quota check unavailable", error instanceof Error ? error.name : "unknown");
    res.status(503).json({
      error: "Tính năng tra từ AI tạm thời không khả dụng. Vui lòng thử lại sau."
    });
    return false;
  }

  if (!quota.allowed) {
    res.setHeader("Retry-After", String(quota.retryAfterSeconds));
    res.status(429).json({
      error: `Bạn đã tra quá ${AI_QUOTA_POLICY.limit} từ trong 1 giờ. Vui lòng thử lại sau ${Math.ceil(quota.retryAfterSeconds / 60)} phút.`
    });
    return false;
  }
  return true;
}
