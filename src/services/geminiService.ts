import { z } from "zod";
import { auth } from "@/lib/firebase";

const wordDetailsSchema = z.object({
  word: z.string(),
  definition: z.string(),
  partOfSpeech: z.string(),
  phonetic: z.string()
});

export type WordDetails = z.infer<typeof wordDetailsSchema>;

export async function getWordDetails(word: string): Promise<WordDetails> {
  const trimmed = word.trim();
  if (!trimmed) {
    throw new Error("Vui lòng nhập từ tiếng Anh cần tra cứu.");
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Bạn cần đăng nhập để sử dụng tính năng tra từ AI.");
  }

  const idToken = await currentUser.getIdToken();

  const response = await fetch("/api/ai/word-details", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({ word: trimmed })
  });

  if (!response.ok) {
    let errorMessage = "Không thể lấy thông tin từ AI.";
    try {
      const errorJson = await response.json();
      if (errorJson?.error) {
        errorMessage = errorJson.error;
      }
    } catch {
      // Fall back to default error message
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return wordDetailsSchema.parse(data);
}
