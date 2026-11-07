import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { enforceAiQuota } from "../lib/aiRateLimit.js";
import { verifyFirebaseIdToken } from "../lib/auth.js";
import { fetchWordDetailsFromGemini } from "../lib/gemini.js";

const wordRequestSchema = z.object({
  word: z
    .string({ required_error: "Vui lòng cung cấp từ cần tra cứu" })
    .trim()
    .min(1, "Từ tra cứu không được để trống")
    .max(100, "Từ tra cứu vượt quá độ dài tối đa cho phép (100 ký tự)")
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Method check
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // 2. Authentication check
  const authHeader = req.headers.authorization;
  let userId: string;
  try {
    userId = (await verifyFirebaseIdToken(authHeader)).uid;
  } catch (authError) {
    return res.status(401).json({
      error: "Unauthorized: Yêu cầu đăng nhập để sử dụng tính năng tra từ AI."
    });
  }

  // 3. Request Body Validation
  let bodyData = req.body;
  if (typeof bodyData === "string") {
    try {
      bodyData = JSON.parse(bodyData);
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  const parseResult = wordRequestSchema.safeParse(bodyData);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "Dữ liệu yêu cầu không hợp lệ",
      details: parseResult.error.flatten().fieldErrors
    });
  }

  const { word } = parseResult.data;

  // 4. Per-user hourly quota (counted in words) before spending Gemini tokens
  if (!(await enforceAiQuota(res, userId, 1))) return;

  // 5. Call Gemini AI via Serverless
  try {
    const details = await fetchWordDetailsFromGemini(word);
    return res.status(200).json(details);
  } catch (error) {
    console.error("Error executing Gemini lookup:", error instanceof Error ? error.message : "Unknown error");
    return res.status(500).json({
      error: "Không thể lấy thông tin từ AI vào lúc này. Vui lòng thử lại sau."
    });
  }
}
