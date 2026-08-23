import { z } from "zod";

export const vocabularyInputSchema = z.object({
  word: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập từ tiếng Anh.")
    .max(100, "Từ tiếng Anh không được vượt quá 100 ký tự."),
  definition: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập định nghĩa tiếng Việt.")
    .max(500, "Định nghĩa không được vượt quá 500 ký tự."),
  phonetic: z
    .string()
    .trim()
    .max(100, "Phiên âm không được vượt quá 100 ký tự.")
    .optional()
    .or(z.literal("")),
  partOfSpeech: z
    .string()
    .trim()
    .max(50, "Loại từ không được vượt quá 50 ký tự.")
    .optional()
    .or(z.literal("")),
  topicId: z.string().trim().optional().or(z.literal(""))
});

export type VocabularyInputFormValues = z.infer<typeof vocabularyInputSchema>;

export const bulkRowSchema = z.object({
  word: z
    .string()
    .trim()
    .min(1, "Từ tiếng Anh không được để trống")
    .max(100, "Từ tiếng Anh vượt quá 100 ký tự"),
  definition: z
    .string()
    .trim()
    .max(500, "Định nghĩa vượt quá 500 ký tự")
    .optional()
    .or(z.literal("")),
  phonetic: z
    .string()
    .trim()
    .max(100, "Phiên âm vượt quá 100 ký tự")
    .optional()
    .or(z.literal("")),
  partOfSpeech: z
    .string()
    .trim()
    .max(50, "Loại từ vượt quá 50 ký tự")
    .optional()
    .or(z.literal("")),
  topicName: z
    .string()
    .trim()
    .max(100, "Tên chủ đề vượt quá 100 ký tự")
    .optional()
    .or(z.literal(""))
});

export type BulkRowInput = z.infer<typeof bulkRowSchema>;
