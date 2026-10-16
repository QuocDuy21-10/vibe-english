import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { verifyFirebaseIdToken } from "../lib/auth.js";
import { fetchBatchWordDetailsFromGemini } from "../lib/gemini.js";

const batchWordsRequestSchema = z.object({
  words: z
    .array(
      z
        .string({ required_error: "Từ tra cứu phải là chuỗi ký tự" })
        .trim()
        .min(1, "Từ tra cứu không được để trống")
        .max(100, "Từ tra cứu vượt quá độ dài tối đa cho phép (100 ký tự)")
    )
    .min(1, "Danh sách từ cần tra cứu không được để trống")
    .max(20, "Tối đa chỉ tra cứu 20 từ trong một yêu cầu để đảm bảo hiệu năng và giới hạn chi phí")
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Method check
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // 2. Authentication check
  const authHeader = req.headers.authorization;
  try {
    await verifyFirebaseIdToken(authHeader);
  } catch {
    return res.status(401).json({
      error: "Unauthorized: Yêu cầu đăng nhập để sử dụng tính năng tra từ AI hàng loạt."
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

  const parseResult = batchWordsRequestSchema.safeParse(bodyData);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "Dữ liệu yêu cầu không hợp lệ",
      details: parseResult.error.flatten().fieldErrors
    });
  }

  const { words } = parseResult.data;

  // 4. Call Gemini AI via Serverless
  try {
    const details = await fetchBatchWordDetailsFromGemini(words);
    return res.status(200).json(details);
  } catch (error) {
    console.error(
      "Error executing Gemini batch lookup:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return res.status(500).json({
      error: "Không thể lấy thông tin từ AI vào lúc này. Vui lòng thử lại sau."
    });
  }
}
