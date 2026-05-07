export interface Topic {
  id: string;
  name: string;
  userId: string;
  createdAt: any;
}

export interface Vocabulary {
  id: string;
  word: string;
  definition: string;
  partOfSpeech: string;
  phonetic: string;
  topicId: string;
  userId: string;
  createdAt: any;
  updatedAt: any;
  level: number;
  nextReview: any;
}

export const SRS_INTERVALS = [1, 3, 7, 14, 30];

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
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}
