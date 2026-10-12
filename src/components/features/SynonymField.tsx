import { useMemo, useState } from "react";
import { BookOpenCheck, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addVocabularySynonym,
  MAX_VOCABULARY_SYNONYMS,
  normalizeVocabularyWord,
  type VocabularySynonymSelection
} from "@/lib/vocabulary";
import type { Vocabulary } from "@/types/types";

type SynonymFieldProps = {
  value: VocabularySynonymSelection;
  onChange: (value: VocabularySynonymSelection) => void;
  vocabularies: Vocabulary[];
  currentVocabularyId?: string;
  currentWord?: string;
};

export function SynonymField({
  value,
  onChange,
  vocabularies,
  currentVocabularyId,
  currentWord
}: SynonymFieldProps) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const selectedIds = useMemo(() => new Set(value.synonymIds), [value.synonymIds]);
  const normalizedQuery = normalizeVocabularyWord(query);
  const suggestions = useMemo(() => {
    if (!normalizedQuery) return [];

    const seenWords = new Set<string>();
    return vocabularies
      .filter((item) => {
        if (item.id === currentVocabularyId || selectedIds.has(item.id)) return false;
        const normalizedWord = item.normalizedWord || normalizeVocabularyWord(item.word);
        if (!normalizedWord.includes(normalizedQuery) || seenWords.has(normalizedWord)) return false;
        seenWords.add(normalizedWord);
        return true;
      })
      .slice(0, 5);
  }, [currentVocabularyId, normalizedQuery, selectedIds, vocabularies]);

  const addCandidate = (candidate: string) => {
    if (candidate.trim().length > 100) {
      setMessage("Từ đồng nghĩa không được vượt quá 100 ký tự.");
      return;
    }

    const result = addVocabularySynonym(candidate, value, vocabularies, {
      currentVocabularyId,
      currentWord
    });

    if (result.status === "self") {
      setMessage("Không thể thêm chính từ đang nhập làm từ đồng nghĩa.");
      return;
    }
    if (result.status === "duplicate") {
      setMessage("Từ đồng nghĩa này đã có trong danh sách.");
      return;
    }
    if (result.status === "limit") {
      setMessage(`Mỗi từ có tối đa ${MAX_VOCABULARY_SYNONYMS} từ đồng nghĩa.`);
      return;
    }
    if (result.status === "empty") return;

    onChange(result.selection);
    setQuery("");
    setMessage(
      result.status === "added_existing"
        ? "Đã liên kết với từ có sẵn trong kho."
        : "Đã thêm từ đồng nghĩa mới."
    );
  };

  const removeExisting = (id: string) => {
    onChange({
      ...value,
      synonymIds: value.synonymIds.filter((item) => item !== id)
    });
    setMessage(null);
  };

  const removeCustom = (word: string) => {
    onChange({
      ...value,
      customSynonyms: value.customSynonyms.filter((item) => item !== word)
    });
    setMessage(null);
  };

  const selectedExisting = value.synonymIds.map((id) => {
    const vocabulary = vocabularies.find((item) => item.id === id);
    return {
      id,
      word: vocabulary?.word ?? "Từ vựng không còn tồn tại",
      isMissing: !vocabulary
    };
  });

  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <label htmlFor="synonym-input" className="text-xs font-semibold text-slate-600 ml-0.5">
          Từ đồng nghĩa
        </label>
        <p className="text-[11px] leading-relaxed text-slate-400">
          Tìm trong kho từ hoặc nhập một từ mới rồi nhấn Enter.
        </p>
      </div>

      {(selectedExisting.length > 0 || value.customSynonyms.length > 0) && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-emerald-100 bg-[#ECFDF5]/60 p-2.5">
          {selectedExisting.map((item) => (
            <Badge
              key={item.id}
              variant="secondary"
              className="h-11 max-w-full gap-1 bg-white py-0 pl-3 pr-0 text-[#065F46] shadow-xs ring-1 ring-emerald-100"
            >
              <BookOpenCheck className="size-3.5 shrink-0" aria-hidden="true" />
              <span className={item.isMissing ? "truncate text-slate-400" : "truncate"}>{item.word}</span>
              <button
                type="button"
                onClick={() => removeExisting(item.id)}
                className="ml-0.5 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                aria-label={`Bỏ từ đồng nghĩa ${item.word}`}
              >
                <X className="size-3.5" />
              </button>
            </Badge>
          ))}
          {value.customSynonyms.map((word) => (
            <Badge
              key={normalizeVocabularyWord(word)}
              variant="outline"
              className="h-11 max-w-full gap-1 border-emerald-200 bg-transparent py-0 pl-3 pr-0 text-slate-700"
            >
              <Plus className="size-3.5 shrink-0 text-[#10b981]" aria-hidden="true" />
              <span className="truncate">{word}</span>
              <button
                type="button"
                onClick={() => removeCustom(word)}
                className="ml-0.5 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                aria-label={`Bỏ từ đồng nghĩa ${word}`}
              >
                <X className="size-3.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <div className="flex gap-2">
          <Input
            id="synonym-input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setMessage(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCandidate(query);
              }
            }}
            placeholder="Ví dụ: joyful, cheerful..."
            className="h-11 rounded-xl border-slate-200 text-sm"
            autoComplete="off"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => addCandidate(query)}
            disabled={!query.trim()}
            aria-label="Thêm từ đồng nghĩa"
            className="h-11 min-h-[44px] shrink-0 rounded-xl border-emerald-200 px-3.5 font-semibold text-[#10b981] hover:bg-[#ECFDF5]"
          >
            <Plus className="size-4 sm:mr-1" />
            <span className="hidden sm:inline">Thêm</span>
          </Button>
        </div>

        {suggestions.length > 0 && (
          <div className="mt-2 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-md">
            <p className="border-b border-slate-100 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Có sẵn trong kho từ
            </p>
            <div className="max-h-48 overflow-y-auto p-1.5">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addCandidate(item.word)}
                  className="flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-[#ECFDF5]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-800">{item.word}</span>
                    <span className="block truncate text-[11px] text-slate-400">{item.definition}</span>
                  </span>
                  <Badge variant="secondary" className="shrink-0 bg-[#ECFDF5] text-[10px] text-[#10b981]">
                    {item.partOfSpeech || "từ vựng"}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {message && <p className="text-[11px] font-medium text-slate-500">{message}</p>}
    </div>
  );
}
