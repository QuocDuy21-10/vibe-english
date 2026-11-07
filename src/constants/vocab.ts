import type { StudyMode } from "@/types/types";

export const LEVELS = [0, 1, 2, 3, 4] as const;
export const DEFAULT_TOPIC_FILTER = "all";
export const UNASSIGNED_TOPIC_FILTER = "none";
export const QUICK_QUIZ_TOPIC = "quick_quiz";
export const SRS_REVIEW_TOPIC = "srs_review";

export const STUDY_MODES: readonly StudyMode[] = ["flashcard", "quiz", "listening", "context"];

export const STUDY_MODE_LABELS: Record<StudyMode, string> = {
  flashcard: "Flashcard",
  quiz: "Điền từ",
  listening: "Nghe",
  context: "Ngữ cảnh"
};

export const PART_OF_SPEECH_OPTIONS = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "prep",
  "conj",
  "other"
] as const;

export type PartOfSpeech = (typeof PART_OF_SPEECH_OPTIONS)[number];

export const VOCAB_IMPORT_COLUMNS = [
  "word",
  "definition",
  "partOfSpeech",
  "phonetic",
  "topic"
] as const;

export type VocabImportColumn = (typeof VOCAB_IMPORT_COLUMNS)[number];

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const TEMPLATE_FILE_NAME = "vocabloom-vocabulary-template.xlsx";
export const VOCAB_SHEET_NAME = "Vocabulary";
export const GUIDE_SHEET_NAME = "HuongDan";

