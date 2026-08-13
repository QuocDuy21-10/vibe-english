import type { Timestamp } from "firebase/firestore";

export interface Topic {
  id: string;
  name: string;
  userId: string;
  createdAt: Timestamp | Date;
}

export interface Vocabulary {
  id: string;
  word: string;
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
}

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
