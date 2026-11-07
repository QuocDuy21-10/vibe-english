import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { generateWordUsages, getWordUsage, isWordUsageStale } from "@/services/wordUsageRepository";
import type { Vocabulary, WordUsage } from "@/types/types";

export type WordUsageState = { status: "loading" } | { status: "ready"; usage: WordUsage } | { status: "error" };

const CHUNK_SIZE = 10;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Không thể tạo câu ví dụ. Vui lòng thử lại.";
}

/** Loads cached usages for the session and generates the missing ones (≤10 per AI request, sequential). */
export function useWordUsages(vocabularies: Vocabulary[], enabled: boolean, userId: string | null) {
  const [states, setStates] = useState<Record<string, WordUsageState>>({});
  // The session queue can repeat a card ("again" requeue); key on unique ids so requeues don't refetch.
  const idsKey = [...new Set(vocabularies.map((vocabulary) => vocabulary.id))].join("|");

  useEffect(() => {
    if (!enabled || !userId) return;
    let cancelled = false;
    const unique = [...new Map(vocabularies.map((vocabulary) => [vocabulary.id, vocabulary])).values()];
    const setMany = (items: Vocabulary[], next: (vocabulary: Vocabulary) => WordUsageState) =>
      setStates((previous) => {
        const updated = { ...previous };
        items.forEach((vocabulary) => {
          updated[vocabulary.id] = next(vocabulary);
        });
        return updated;
      });

    void (async () => {
      setMany(unique, () => ({ status: "loading" }));

      const missing: Vocabulary[] = [];
      await Promise.all(
        unique.map(async (vocabulary) => {
          try {
            const cached = await getWordUsage(vocabulary.id);
            if (cached && !isWordUsageStale(cached, vocabulary)) {
              if (!cancelled) setMany([vocabulary], () => ({ status: "ready", usage: cached }));
              return;
            }
          } catch {
            // A failed cache read falls through to regeneration.
          }
          missing.push(vocabulary);
        })
      );
      // Keep the session order so the first cards are generated first.
      missing.sort((a, b) => unique.indexOf(a) - unique.indexOf(b));

      for (let start = 0; start < missing.length; start += CHUNK_SIZE) {
        if (cancelled) return;
        const chunk = missing.slice(start, start + CHUNK_SIZE);
        try {
          const usages = await generateWordUsages(chunk, userId);
          if (cancelled) return;
          setMany(chunk, (vocabulary) => ({ status: "ready", usage: usages[chunk.indexOf(vocabulary)] }));
        } catch (error) {
          if (cancelled) return;
          // Quota or outage would fail every later chunk too; stop and let the user retry per card.
          setMany(missing.slice(start), () => ({ status: "error" }));
          toast.error(errorMessage(error));
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // vocabularies is read through idsKey; same ids means same work.
  }, [enabled, userId, idsKey]);

  const retry = useCallback(
    (vocabulary: Vocabulary) => {
      if (!userId) return;
      setStates((previous) => ({ ...previous, [vocabulary.id]: { status: "loading" } }));
      void generateWordUsages([vocabulary], userId)
        .then(([usage]) => setStates((previous) => ({ ...previous, [vocabulary.id]: { status: "ready", usage } })))
        .catch((error: unknown) => {
          setStates((previous) => ({ ...previous, [vocabulary.id]: { status: "error" } }));
          toast.error(errorMessage(error));
        });
    },
    [userId]
  );

  return { states, retry };
}
