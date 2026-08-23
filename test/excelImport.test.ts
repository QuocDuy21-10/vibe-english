import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  GUIDE_SHEET_NAME,
  MAX_IMPORT_ROWS,
  VOCAB_IMPORT_COLUMNS,
  VOCAB_SHEET_NAME
} from "@/constants/vocab";
import {
  normalizePartOfSpeech,
  parseAndValidateExcelFile,
  validateWorksheetHeaders
} from "@/lib/excelParser";
import { generateVocabularyTemplateWorkbook } from "@/lib/excelTemplate";
import type { Topic, Vocabulary } from "@/types/types";

// Helper to convert workbook into ArrayBuffer for parser testing
function workbookToArrayBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  const u8 = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return u8;
}

// Mock test topics
const mockTopics: Topic[] = [
  { id: "topic-1", name: "Food & Drinks", userId: "user-1", createdAt: new Date() },
  { id: "topic-2", name: "Technology", userId: "user-1", createdAt: new Date() },
  { id: "topic-3", name: "Travel", userId: "user-1", createdAt: new Date() }
];

// Mock existing vocabularies in DB
const mockVocabularies: Vocabulary[] = [
  {
    id: "vocab-1",
    word: "apple",
    normalizedWord: "apple",
    definition: "quả táo",
    partOfSpeech: "noun",
    phonetic: "/ˈæp.əl/",
    topicId: "topic-1",
    userId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    level: 2,
    nextReview: new Date()
  },
  {
    id: "vocab-2",
    word: "computer",
    normalizedWord: "computer",
    definition: "máy vi tính",
    partOfSpeech: "noun",
    phonetic: "/kəmˈpjuː.tər/",
    topicId: "topic-2",
    userId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    level: 0,
    nextReview: new Date()
  }
];

describe("Excel Template Generator", () => {
  it("generates a workbook with Vocabulary and HuongDan sheets", () => {
    const wb = generateVocabularyTemplateWorkbook();
    expect(wb.SheetNames).toContain(VOCAB_SHEET_NAME);
    expect(wb.SheetNames).toContain(GUIDE_SHEET_NAME);
  });

  it("sets the exact 5 fixed headers in the Vocabulary sheet", () => {
    const wb = generateVocabularyTemplateWorkbook();
    const vocabWs = wb.Sheets[VOCAB_SHEET_NAME];
    const rows = XLSX.utils.sheet_to_json<string[]>(vocabWs, { header: 1 });

    expect(rows.length).toBe(1); // Only header, no pre-filled sample rows
    expect(rows[0]).toEqual([...VOCAB_IMPORT_COLUMNS]);
  });
});

describe("Header Structure Validation", () => {
  it("passes when headers match VOCAB_IMPORT_COLUMNS exactly", () => {
    const result = validateWorksheetHeaders([...VOCAB_IMPORT_COLUMNS]);
    expect(result.isValid).toBe(true);
    expect(result.columnIndexes).toBeDefined();
    expect(result.columnIndexes?.word).toBe(0);
    expect(result.columnIndexes?.definition).toBe(1);
    expect(result.columnIndexes?.partOfSpeech).toBe(2);
    expect(result.columnIndexes?.phonetic).toBe(3);
    expect(result.columnIndexes?.topic).toBe(4);
  });

  it("fails when required columns are missing", () => {
    const result = validateWorksheetHeaders(["word", "partOfSpeech", "topic"]);
    expect(result.isValid).toBe(false);
    expect(result.structureError?.missingColumns).toContain("definition");
    expect(result.structureError?.missingColumns).toContain("phonetic");
  });

  it("fails when unsupported extra columns are present", () => {
    const result = validateWorksheetHeaders([
      "word",
      "definition",
      "partOfSpeech",
      "phonetic",
      "topic",
      "exampleSentence"
    ]);
    expect(result.isValid).toBe(false);
    expect(result.structureError?.extraColumns).toContain("exampleSentence");
  });

  it("fails when columns are renamed (e.g. definition -> meaning)", () => {
    const result = validateWorksheetHeaders([
      "word",
      "meaning",
      "partOfSpeech",
      "phonetic",
      "topic"
    ]);
    expect(result.isValid).toBe(false);
    expect(result.structureError?.missingColumns).toContain("definition");
    expect(result.structureError?.extraColumns).toContain("meaning");
  });

  it("fails when header row has duplicate columns", () => {
    const result = validateWorksheetHeaders([
      "word",
      "word",
      "definition",
      "partOfSpeech",
      "phonetic",
      "topic"
    ]);
    expect(result.isValid).toBe(false);
    expect(result.structureError?.customMessage).toMatch(/lặp lại/);
  });
});

describe("Part of Speech Normalization", () => {
  it("normalizes standard part of speech strings", () => {
    expect(normalizePartOfSpeech("noun")).toBe("noun");
    expect(normalizePartOfSpeech("Noun")).toBe("noun");
    expect(normalizePartOfSpeech("VERB ")).toBe("verb");
    expect(normalizePartOfSpeech("ADJECTIVE")).toBe("adjective");
    expect(normalizePartOfSpeech("adj")).toBe("adjective");
    expect(normalizePartOfSpeech("adv")).toBe("adverb");
    expect(normalizePartOfSpeech("prep")).toBe("prep");
    expect(normalizePartOfSpeech("conj")).toBe("conj");
    expect(normalizePartOfSpeech("other")).toBe("other");
  });

  it("returns null for invalid part of speech", () => {
    expect(normalizePartOfSpeech("random_pos")).toBeNull();
    expect(normalizePartOfSpeech("")).toBeNull();
  });
});

describe("Full Excel File Parser & Validator", () => {
  it("rejects corrupted/invalid non-Excel file buffers", () => {
    const invalidBuffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    const result = parseAndValidateExcelFile(invalidBuffer, mockVocabularies, mockTopics);
    expect(result.success).toBe(false);
    expect(result.structureError).toBeDefined();
    expect(result.rows).toHaveLength(0);
  });

  it("rejects files without the Vocabulary sheet", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([["word", "definition"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    const result = parseAndValidateExcelFile(workbookToArrayBuffer(wb), mockVocabularies, mockTopics);
    expect(result.success).toBe(false);
    expect(result.structureError?.invalidSheet).toBe(true);
  });

  it("successfully parses valid vocabulary rows", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [...VOCAB_IMPORT_COLUMNS],
      ["banana", "quả chuối", "noun", "/bəˈnɑː.nə/", "Food & Drinks"],
      ["resilient", "kiên cường", "adjective", "/rɪˈzɪl.jənt/", ""],
      ["develop", "phát triển", "verb", "/dɪˈvel.əp/", "Technology"]
    ]);
    XLSX.utils.book_append_sheet(wb, ws, VOCAB_SHEET_NAME);

    const result = parseAndValidateExcelFile(workbookToArrayBuffer(wb), mockVocabularies, mockTopics);
    expect(result.success).toBe(true);
    expect(result.summary.total).toBe(3);
    expect(result.summary.valid).toBe(3);
    expect(result.summary.invalid).toBe(0);
    expect(result.rows[0].topicId).toBe("topic-1");
    expect(result.rows[1].topicId).toBeNull();
    expect(result.rows[2].topicId).toBe("topic-2");
  });

  it("ignores completely empty rows at the end of the sheet", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [...VOCAB_IMPORT_COLUMNS],
      ["banana", "quả chuối", "noun", "", ""],
      ["", "", "", "", ""],
      ["  ", "   ", "", "", "  "],
      ["orange", "quả cam", "noun", "", ""]
    ]);
    XLSX.utils.book_append_sheet(wb, ws, VOCAB_SHEET_NAME);

    const result = parseAndValidateExcelFile(workbookToArrayBuffer(wb), mockVocabularies, mockTopics);
    expect(result.success).toBe(true);
    expect(result.summary.total).toBe(2);
    expect(result.summary.valid).toBe(2);
  });

  it("detects missing required fields (word, definition)", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [...VOCAB_IMPORT_COLUMNS],
      ["", "quả táo", "noun", "", ""], // Missing word
      ["banana", "", "noun", "", ""], // Missing definition
      ["valid_word", "có nghĩa", "noun", "", ""]
    ]);
    XLSX.utils.book_append_sheet(wb, ws, VOCAB_SHEET_NAME);

    const result = parseAndValidateExcelFile(workbookToArrayBuffer(wb), mockVocabularies, mockTopics);
    expect(result.success).toBe(true);
    expect(result.summary.total).toBe(3);
    expect(result.summary.valid).toBe(1);
    expect(result.summary.invalid).toBe(2);
    expect(result.rows[0].status).toBe("invalid");
    expect(result.rows[0].errors).toContain("Từ tiếng Anh không được để trống");
    expect(result.rows[1].status).toBe("invalid");
    expect(result.rows[1].errors).toContain("Định nghĩa tiếng Việt không được để trống");
  });

  it("detects invalid partOfSpeech values", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [...VOCAB_IMPORT_COLUMNS],
      ["run", "chạy", "invalid_type", "", ""]
    ]);
    XLSX.utils.book_append_sheet(wb, ws, VOCAB_SHEET_NAME);

    const result = parseAndValidateExcelFile(workbookToArrayBuffer(wb), mockVocabularies, mockTopics);
    expect(result.summary.invalid).toBe(1);
    expect(result.rows[0].status).toBe("invalid");
    expect(result.rows[0].errors[0]).toMatch(/Loại từ "invalid_type" không hợp lệ/);
  });

  it("detects duplicate words inside the same file (intra-file duplicate)", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [...VOCAB_IMPORT_COLUMNS],
      ["orange", "quả cam", "noun", "", ""], // Row 2
      ["banana", "quả chuối", "noun", "", ""], // Row 3
      ["Orange", "trái cam (lặp)", "noun", "", ""], // Row 4 (duplicate of Row 2)
      [" ORANGE ", "cam nữa", "noun", "", ""] // Row 5 (duplicate of Row 2)
    ]);
    XLSX.utils.book_append_sheet(wb, ws, VOCAB_SHEET_NAME);

    const result = parseAndValidateExcelFile(workbookToArrayBuffer(wb), mockVocabularies, mockTopics);
    expect(result.summary.total).toBe(4);
    expect(result.summary.valid).toBe(2);
    expect(result.summary.duplicateInFile).toBe(2);

    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[1].status).toBe("valid");
    expect(result.rows[2].status).toBe("duplicate-in-file");
    expect(result.rows[2].errors).toContain("Trùng với dòng 2 trong file");
    expect(result.rows[3].status).toBe("duplicate-in-file");
    expect(result.rows[3].errors).toContain("Trùng với dòng 2 trong file");
  });

  it("detects duplicate words with user existing database records", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [...VOCAB_IMPORT_COLUMNS],
      ["Apple", "quả táo mới", "noun", "", ""], // Already in mockVocabularies ("apple")
      ["COMPUTER", "máy tính", "noun", "", ""], // Already in mockVocabularies ("computer")
      ["strawberry", "dâu tây", "noun", "", ""]
    ]);
    XLSX.utils.book_append_sheet(wb, ws, VOCAB_SHEET_NAME);

    const result = parseAndValidateExcelFile(workbookToArrayBuffer(wb), mockVocabularies, mockTopics);
    expect(result.summary.total).toBe(3);
    expect(result.summary.valid).toBe(1);
    expect(result.summary.duplicateExisting).toBe(2);

    expect(result.rows[0].status).toBe("duplicate-existing");
    expect(result.rows[0].errors).toContain("Từ này đã có trong từ điển của bạn");
    expect(result.rows[1].status).toBe("duplicate-existing");
    expect(result.rows[2].status).toBe("valid");
  });

  it("handles topic matching and non-existent topics", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [...VOCAB_IMPORT_COLUMNS],
      ["flight", "chuyến bay", "noun", "", "travel"], // lowercase match "Travel" -> topic-3
      ["hotel", "khách sạn", "noun", "", "Travle"], // Typo in topic -> invalid
      ["coffee", "cà phê", "noun", "", ""] // empty topic -> null
    ]);
    XLSX.utils.book_append_sheet(wb, ws, VOCAB_SHEET_NAME);

    const result = parseAndValidateExcelFile(workbookToArrayBuffer(wb), mockVocabularies, mockTopics);
    expect(result.summary.total).toBe(3);
    expect(result.summary.valid).toBe(2);
    expect(result.summary.invalid).toBe(1);

    expect(result.rows[0].topicId).toBe("topic-3");
    expect(result.rows[0].status).toBe("valid");

    expect(result.rows[1].status).toBe("invalid");
    expect(result.rows[1].errors).toContain(
      'Chủ đề "Travle" không tồn tại trong danh sách chủ đề của bạn'
    );

    expect(result.rows[2].topicId).toBeNull();
    expect(result.rows[2].status).toBe("valid");
  });

  it("rejects files that exceed the maximum row limit (500 rows)", () => {
    const wb = XLSX.utils.book_new();
    const rows: string[][] = [[...VOCAB_IMPORT_COLUMNS]];
    for (let i = 1; i <= MAX_IMPORT_ROWS + 10; i++) {
      rows.push([`word${i}`, `nghĩa ${i}`, "noun", "", ""]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, VOCAB_SHEET_NAME);

    const result = parseAndValidateExcelFile(workbookToArrayBuffer(wb), mockVocabularies, mockTopics);
    expect(result.success).toBe(false);
    expect(result.structureError?.exceededMaxRows).toBe(true);
    expect(result.structureError?.customMessage).toMatch(/quá nhiều dữ liệu/);
  });
});
