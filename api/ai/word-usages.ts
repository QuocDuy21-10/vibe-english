import type { VercelRequest, VercelResponse } from "@vercel/node";
import { enforceAiQuota } from "../lib/aiRateLimit.js";
import { verifyFirebaseIdToken } from "../lib/auth.js";
import { fetchWordUsagesFromGemini } from "../lib/gemini.js";
import { alignWordUsages, wordUsagesRequestSchema } from "../lib/wordUsages.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  let userId: string;
  try {
    userId = (await verifyFirebaseIdToken(req.headers.authorization)).uid;
  } catch {
    return res.status(401).json({
      error: "Unauthorized: Yêu cầu đăng nhập để tạo ví dụ bằng AI."
    });
  }

  let bodyData = req.body;
  if (typeof bodyData === "string") {
    try {
      bodyData = JSON.parse(bodyData);
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  const parseResult = wordUsagesRequestSchema.safeParse(bodyData);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "Dữ liệu yêu cầu không hợp lệ",
      details: parseResult.error.flatten().fieldErrors
    });
  }

  const { items } = parseResult.data;

  if (!(await enforceAiQuota(res, userId, items.length))) return;

  try {
    const usages = await fetchWordUsagesFromGemini(items);
    return res.status(200).json(alignWordUsages(items, usages));
  } catch (error) {
    console.error("Error generating word usages:", error instanceof Error ? error.message : "Unknown error");
    return res.status(500).json({
      error: "Không thể tạo ví dụ từ AI vào lúc này. Vui lòng thử lại sau."
    });
  }
}
