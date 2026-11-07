import { z } from "zod";

export const MAX_WORD_USAGE_ITEMS = 10;
export const MAX_EXAMPLES = 5;
export const MAX_COLLOCATIONS = 8;

export const wordUsagesRequestSchema = z.object({
  items: z
    .array(
      z.object({
        word: z.string().trim().min(1, "Từ không được để trống").max(100, "Từ vượt quá 100 ký tự"),
        partOfSpeech: z.string().trim().max(50, "Từ loại vượt quá 50 ký tự"),
        definition: z.string().trim().min(1, "Nghĩa không được để trống").max(500, "Nghĩa vượt quá 500 ký tự")
      })
    )
    .min(1, "Danh sách từ không được để trống")
    .max(MAX_WORD_USAGE_ITEMS, `Tối đa ${MAX_WORD_USAGE_ITEMS} từ mỗi yêu cầu`)
});

export type WordUsageRequestItem = z.infer<typeof wordUsagesRequestSchema>["items"][number];

export const serverWordUsageSchema = z.object({
  word: z.string(),
  examples: z.array(z.object({ sentence: z.string(), translation: z.string(), answer: z.string() })),
  collocations: z.array(z.object({ phrase: z.string(), meaning: z.string() }))
});

export type ServerWordUsage = z.infer<typeof serverWordUsageSchema>;

function containsAnswer(sentence: string, answer: string): boolean {
  const target = answer.trim().toLowerCase();
  return target.length > 0 && sentence.toLowerCase().includes(target);
}

/** One result per requested item, in request order; examples that cannot be turned into a cloze are dropped. */
export function alignWordUsages(items: WordUsageRequestItem[], raw: ServerWordUsage[]): ServerWordUsage[] {
  return items.map((item) => {
    const match = raw.find((usage) => usage.word.trim().toLowerCase() === item.word.toLowerCase());
    return {
      word: item.word,
      examples: (match?.examples ?? [])
        .filter((example) => containsAnswer(example.sentence, example.answer))
        .map((example) => ({ ...example, answer: example.answer.trim() }))
        .slice(0, MAX_EXAMPLES),
      collocations: (match?.collocations ?? []).slice(0, MAX_COLLOCATIONS)
    };
  });
}
