import { normalizeVocabularyWord } from "@/lib/vocabulary";
import { bulkRowSchema } from "@/lib/vocabularyValidation";
import type {
  AnalyzedBulkRow,
  BulkSummary,
  ParsedBulkItem,
  Topic,
  Vocabulary
} from "@/types/types";

/**
 * Parses multiline raw text entered by the user.
 * Supports:
 * - `word`
 * - `word | definition`
 * - `word | definition | partOfSpeech | phonetic`
 * - `word | definition | partOfSpeech | phonetic | topic`
 * Also supports comma or tab separators if pipes are not used on that line.
 */
export function parseBulkText(text: string, defaultTopicId?: string): ParsedBulkItem[] {
  if (!text || !text.trim()) return [];

  const lines = text.split(/\r?\n/);
  const items: ParsedBulkItem[] = [];

  lines.forEach((line, index) => {
    const rawLine = line.trim();
    if (!rawLine) return;

    let parts: string[];
    if (rawLine.includes("|")) {
      parts = rawLine.split("|").map((p) => p.trim());
    } else if (rawLine.includes("\t")) {
      parts = rawLine.split("\t").map((p) => p.trim());
    } else {
      parts = [rawLine];
    }

    const word = parts[0] || "";
    const definition = parts[1] || "";
    const partOfSpeech = parts[2] || "";
    const phonetic = parts[3] || "";
    const topicName = parts[4] || "";

    items.push({
      rawId: `text-${index + 1}-${Date.now()}`,
      word,
      definition,
      partOfSpeech,
      phonetic,
      topicName,
      topicId: defaultTopicId || null
    });
  });

  return items;
}

/**
 * Lightweight RFC 4180 CSV tokenizer and parser without external dependencies.
 * Handles quotes, commas inside quotes, escaped quotes, newlines, and UTF-8 BOM.
 */
export function parseCsvRows(csvContent: string): string[][] {
  const clean = csvContent.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (char === "\r") {
        if (nextChar === "\n") i++;
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else if (char === "\n") {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows.filter((r) => r.some((field) => field.length > 0));
}

/**
 * Parses CSV content into ParsedBulkItem array with topic matching.
 */
export function parseCsvContent(
  csvContent: string,
  topics: Topic[] = [],
  defaultTopicId?: string
): ParsedBulkItem[] {
  const rows = parseCsvRows(csvContent);
  if (rows.length === 0) return [];

  // Determine headers if first row looks like a header
  const firstRow = rows[0].map((h) => h.toLowerCase());
  const hasHeader =
    firstRow.includes("word") ||
    firstRow.includes("definition") ||
    firstRow.includes("từ") ||
    firstRow.includes("nghĩa");

  let wordIdx = 0;
  let defIdx = 1;
  let posIdx = 2;
  let phoIdx = 3;
  let topicIdx = 4;

  let dataRows = rows;

  if (hasHeader) {
    wordIdx = firstRow.findIndex((h) => h === "word" || h === "từ" || h === "tu");
    defIdx = firstRow.findIndex((h) => h === "definition" || h === "nghĩa" || h === "nghia");
    posIdx = firstRow.findIndex((h) => h === "partofspeech" || h === "pos" || h === "loại từ" || h === "loai tu");
    phoIdx = firstRow.findIndex((h) => h === "phonetic" || h === "phiên âm" || h === "phien am");
    topicIdx = firstRow.findIndex((h) => h === "topic" || h === "chủ đề" || h === "chu de");

    if (wordIdx === -1) wordIdx = 0;
    dataRows = rows.slice(1);
  }

  // Precompute topic mapping by lowercase name
  const topicMap = new Map<string, string>();
  topics.forEach((t) => {
    topicMap.set(t.name.trim().toLowerCase(), t.id);
  });

  return dataRows.map((cols, index) => {
    const word = (wordIdx !== -1 && cols[wordIdx]) ? cols[wordIdx] : "";
    const definition = (defIdx !== -1 && cols[defIdx]) ? cols[defIdx] : "";
    const partOfSpeech = (posIdx !== -1 && cols[posIdx]) ? cols[posIdx] : "";
    const phonetic = (phoIdx !== -1 && cols[phoIdx]) ? cols[phoIdx] : "";
    const topicName = (topicIdx !== -1 && cols[topicIdx]) ? cols[topicIdx] : "";

    let topicId = defaultTopicId || null;
    if (topicName) {
      const matched = topicMap.get(topicName.trim().toLowerCase());
      if (matched) {
        topicId = matched;
      }
    }

    return {
      rawId: `csv-${index + 1}-${Date.now()}`,
      word,
      definition,
      partOfSpeech,
      phonetic,
      topicName,
      topicId
    };
  });
}

/**
 * Analyzes parsed items: validates fields, detects intra-batch duplicates,
 * and detects existing Firestore duplicates.
 */
export function analyzeBulkItems(
  items: ParsedBulkItem[],
  existingVocabularies: Vocabulary[]
): { rows: AnalyzedBulkRow[]; summary: BulkSummary } {
  // Pre-index existing normalized words in DB
  const existingSet = new Set<string>();
  existingVocabularies.forEach((v) => {
    const norm = v.normalizedWord || normalizeVocabularyWord(v.word);
    if (norm) existingSet.add(norm);
  });

  const seenInBatch = new Set<string>();
  const rows: AnalyzedBulkRow[] = [];

  let valid = 0;
  let duplicateInFile = 0;
  let duplicateInDb = 0;
  let invalid = 0;

  items.forEach((item) => {
    const normalized = normalizeVocabularyWord(item.word);

    // 1. Check validation using Zod
    const validationResult = bulkRowSchema.safeParse(item);
    if (!validationResult.success || !normalized) {
      invalid++;
      const errorMessage =
        validationResult.error?.errors[0]?.message || "Từ không hợp lệ";
      rows.push({
        ...item,
        normalizedWord: normalized,
        status: "invalid",
        errorMessage
      });
      return;
    }

    // 2. Check intra-batch duplicates
    if (seenInBatch.has(normalized)) {
      duplicateInFile++;
      rows.push({
        ...item,
        normalizedWord: normalized,
        status: "duplicate_in_file",
        errorMessage: "Từ bị lặp lại trong danh sách nhập"
      });
      return;
    }
    seenInBatch.add(normalized);

    // 3. Check DB duplicates
    if (existingSet.has(normalized)) {
      duplicateInDb++;
      rows.push({
        ...item,
        normalizedWord: normalized,
        status: "duplicate_in_db",
        errorMessage: "Từ đã tồn tại trong từ điển của bạn"
      });
      return;
    }

    // 4. Valid item
    valid++;
    rows.push({
      ...item,
      normalizedWord: normalized,
      status: "valid"
    });
  });

  return {
    rows,
    summary: {
      total: items.length,
      valid,
      duplicateInFile,
      duplicateInDb,
      invalid
    }
  };
}
