import type { WordUsageExample } from "@/types/types";

export type Cloze = { before: string; answer: string; after: string };

export function buildCloze(sentence: string, answer: string): Cloze | null {
  const target = answer.trim();
  if (!target) return null;
  const index = sentence.toLowerCase().indexOf(target.toLowerCase());
  if (index === -1) return null;
  return {
    before: sentence.slice(0, index),
    answer: sentence.slice(index, index + target.length),
    after: sentence.slice(index + target.length)
  };
}

/** Stable pick per key (vocabulary id + session seed), so re-renders show the same sentence. */
export function pickClozeExample(
  examples: WordUsageExample[],
  key: string
): { example: WordUsageExample; cloze: Cloze } | null {
  const usable = examples.flatMap((example) => {
    const cloze = buildCloze(example.sentence, example.answer);
    return cloze ? [{ example, cloze }] : [];
  });
  if (usable.length === 0) return null;

  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return usable[hash % usable.length];
}
