import type { Timestamp } from "firebase/firestore";
import type { FlashcardRating } from "@/lib/srs";

export interface Topic {
  id: string;
  name: string;
  userId: string;
  createdAt: Timestamp | Date;
}

export interface Vocabulary {
  id: string;
  word: string;
  normalizedWord?: string;
  definition: string;
  partOfSpeech: string;
  phonetic: string;
  topicId: string | null;
  userId: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  level: number;
  nextReview: Timestamp | Date | null;
  srsVersion?: 1;
  intervalDays?: number;
  easeFactor?: number;
  repetitions?: number;
  lapses?: number;
  lastReviewedAt?: Timestamp | Date | null;
  synonymIds?: string[];
  customSynonyms?: string[];
}

export type BulkRowStatus = "valid" | "duplicate_in_file" | "duplicate_in_db" | "invalid";

export type ImportRowStatus = "valid" | "duplicate-in-file" | "duplicate-existing" | "invalid";

export interface RawImportRow {
  rowNumber: number;
  word: string;
  definition: string;
  partOfSpeech: string;
  phonetic: string;
  topicName: string;
}

export interface ProcessedImportRow {
  rowNumber: number;
  word: string;
  normalizedWord: string;
  definition: string;
  partOfSpeech: string;
  phonetic: string;
  topicName: string;
  topicId: string | null;
  status: ImportRowStatus;
  errors: string[];
}

export interface ImportStructureError {
  missingColumns: string[];
  extraColumns: string[];
  invalidSheet?: boolean;
  emptyFile?: boolean;
  exceededMaxRows?: boolean;
  customMessage?: string;
}

export interface ImportAnalysisResult {
  success: boolean;
  structureError?: ImportStructureError;
  rows: ProcessedImportRow[];
  summary: {
    total: number;
    valid: number;
    duplicateInFile: number;
    duplicateExisting: number;
    invalid: number;
  };
}

export interface ParsedBulkItem {
  rawId: string;
  word: string;
  definition?: string;
  partOfSpeech?: string;
  phonetic?: string;
  topicName?: string;
  topicId?: string | null;
}

export interface AnalyzedBulkRow extends ParsedBulkItem {
  normalizedWord: string;
  status: BulkRowStatus;
  errorMessage?: string;
}

export interface BulkSummary {
  total: number;
  valid: number;
  duplicateInFile: number;
  duplicateInDb: number;
  invalid: number;
}

export interface BatchCreateResult {
  totalCount: number;
  successCount: number;
  failedCount: number;
}


export interface ReviewEvent {
  id?: string;
  userId: string;
  vocabularyId: string;
  rating: FlashcardRating;
  previousLevel: number;
  newLevel: number;
  previousIntervalDays: number;
  newIntervalDays: number;
  reviewedAt: Timestamp | Date;
  topicId?: string | null;
  srsVersion: number;
}

export type StudySession = {
  initialCount: number;
  completedCount: number;
  againCount: number;
  hardCount: number;
  goodCount: number;
  easyCount: number;
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    isAuthenticated: boolean;
  }
}
