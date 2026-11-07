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

export const batchWordDetailsSchema = z.array(wordDetailsSchema);

export async function getBatchWordDetails(
  words: string[],
  onProgress?: (processed: number, total: number) => void
): Promise<WordDetails[]> {
  const trimmedWords = words.map((w) => w.trim()).filter(Boolean);
  if (trimmedWords.length === 0) {
    return [];
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Bạn cần đăng nhập để sử dụng tính năng tra từ AI.");
  }

  const idToken = await currentUser.getIdToken();
  const BATCH_CHUNK_SIZE = 20;
  const results: WordDetails[] = [];
  let processed = 0;
  let quotaExhausted = false;

  for (let i = 0; i < trimmedWords.length; i += BATCH_CHUNK_SIZE) {
    const chunk = trimmedWords.slice(i, i + BATCH_CHUNK_SIZE);

    try {
      const response = await fetch("/api/ai/batch-details", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ words: chunk })
      });

      if (!response.ok) {
        // The server's hourly quota rejects every later chunk too, so stop sending them.
        quotaExhausted = response.status === 429;
        let errorMessage = "Không thể lấy thông tin từ AI hàng loạt.";
        try {
          const errorJson = await response.json();
          if (errorJson?.error) {
            errorMessage = errorJson.error;
          }
        } catch {
          // Fall back
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const parsedChunk = batchWordDetailsSchema.parse(data);
      results.push(...parsedChunk);
    } catch (chunkError) {
      console.error("Batch AI chunk error:", chunkError);
      // Fallback: fill dummy or partial items if chunk fails so user doesn't lose all progress
      chunk.forEach((word) => {
        results.push({
          word,
          definition: "",
          partOfSpeech: "",
          phonetic: ""
        });
      });
    }

    processed += chunk.length;
    if (quotaExhausted) {
      trimmedWords.slice(processed).forEach((word) => {
        results.push({ word, definition: "", partOfSpeech: "", phonetic: "" });
      });
      processed = trimmedWords.length;
    }
    if (onProgress) {
      onProgress(Math.min(processed, trimmedWords.length), trimmedWords.length);
    }
    if (quotaExhausted) break;
  }

  return results;
}

const wordUsageResponseSchema = z.array(
  z.object({
    word: z.string(),
    examples: z.array(z.object({ sentence: z.string(), translation: z.string(), answer: z.string() })),
    collocations: z.array(z.object({ phrase: z.string(), meaning: z.string() }))
  })
);

export type WordUsageRequestItem = { word: string; partOfSpeech: string; definition: string };
export type GeneratedWordUsage = z.infer<typeof wordUsageResponseSchema>[number];

/** Calls the server for ≤10 words; results are in the same order as `items`. */
export async function getWordUsages(items: WordUsageRequestItem[]): Promise<GeneratedWordUsage[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Bạn cần đăng nhập để sử dụng tính năng tra từ AI.");
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch("/api/ai/word-usages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({ items })
  });

  if (!response.ok) {
    let errorMessage = "Không thể tạo ví dụ từ AI.";
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

  return wordUsageResponseSchema.parse(await response.json());
}
