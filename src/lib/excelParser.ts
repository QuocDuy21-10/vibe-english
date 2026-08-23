import * as XLSX from "xlsx";
import {
  MAX_IMPORT_ROWS,
  PART_OF_SPEECH_OPTIONS,
  type PartOfSpeech,
  VOCAB_IMPORT_COLUMNS,
  VOCAB_SHEET_NAME
} from "@/constants/vocab";
import { normalizeVocabularyWord } from "@/lib/vocabulary";
import type {
  ImportAnalysisResult,
  ImportRowStatus,
  ImportStructureError,
  ProcessedImportRow,
  Topic,
  Vocabulary
} from "@/types/types";

/**
 * Validates whether a given partOfSpeech string matches allowed options.
 * Case-insensitive, trims whitespace, and returns standard lowercase representation.
 */
export function normalizePartOfSpeech(pos: string): PartOfSpeech | null {
  if (!pos) return null;
  const clean = pos.trim().toLowerCase();
  if ((PART_OF_SPEECH_OPTIONS as readonly string[]).includes(clean)) {
    return clean as PartOfSpeech;
  }
  // Common aliases
  if (clean === "adj") return "adjective";
  if (clean === "adv") return "adverb";
  return null;
}

/**
 * Validates the structure of the worksheet headers against the fixed VOCAB_IMPORT_COLUMNS definition.
 * Detects missing columns, unsupported extra columns, and duplicated headers.
 */
export function validateWorksheetHeaders(
  rawHeaders: (string | number | null | undefined)[]
): {
  isValid: boolean;
  structureError?: ImportStructureError;
  columnIndexes?: Record<(typeof VOCAB_IMPORT_COLUMNS)[number], number>;
} {
  // Clean headers (trim and filter out trailing completely empty cells)
  const headerStrings = rawHeaders.map((h) => (h != null ? String(h).trim() : ""));

  // Find the last non-empty header index
  let lastNonEmptyIdx = -1;
  for (let i = headerStrings.length - 1; i >= 0; i--) {
    if (headerStrings[i].length > 0) {
      lastNonEmptyIdx = i;
      break;
    }
  }

  const effectiveHeaders = lastNonEmptyIdx >= 0 ? headerStrings.slice(0, lastNonEmptyIdx + 1) : [];

  if (effectiveHeaders.length === 0) {
    return {
      isValid: false,
      structureError: {
        missingColumns: [...VOCAB_IMPORT_COLUMNS],
        extraColumns: [],
        customMessage: "Dòng tiêu đề (header) của file đang bị rỗng."
      }
    };
  }

  // Check for duplicated headers
  const seenHeaderMap = new Map<string, number>();
  const duplicateHeaders: string[] = [];
  effectiveHeaders.forEach((h, idx) => {
    if (!h) return;
    if (seenHeaderMap.has(h)) {
      duplicateHeaders.push(h);
    } else {
      seenHeaderMap.set(h, idx);
    }
  });

  if (duplicateHeaders.length > 0) {
    return {
      isValid: false,
      structureError: {
        missingColumns: [],
        extraColumns: [],
        customMessage: `File có cột tiêu đề bị lặp lại: ${duplicateHeaders.join(", ")}`
      }
    };
  }

  const missingColumns: string[] = [];
  const columnIndexes: Record<string, number> = {};

  VOCAB_IMPORT_COLUMNS.forEach((expectedCol) => {
    const foundIdx = effectiveHeaders.findIndex((h) => h === expectedCol);
    if (foundIdx === -1) {
      missingColumns.push(expectedCol);
    } else {
      columnIndexes[expectedCol] = foundIdx;
    }
  });

  const extraColumns: string[] = [];
  effectiveHeaders.forEach((h) => {
    if (!h) {
      extraColumns.push("(Cột không có tên)");
    } else if (!(VOCAB_IMPORT_COLUMNS as readonly string[]).includes(h)) {
      extraColumns.push(h);
    }
  });

  if (missingColumns.length > 0 || extraColumns.length > 0) {
    return {
      isValid: false,
      structureError: {
        missingColumns,
        extraColumns
      }
    };
  }

  return {
    isValid: true,
    columnIndexes: columnIndexes as Record<(typeof VOCAB_IMPORT_COLUMNS)[number], number>
  };
}

/**
 * Parses and validates an uploaded Excel file buffer against the strict template structure,
 * row validations, topic mappings, and duplicate detection.
 */
export function parseAndValidateExcelFile(
  fileBuffer: ArrayBuffer | Uint8Array,
  existingVocabularies: Vocabulary[],
  userTopics: Topic[]
): ImportAnalysisResult {
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(fileBuffer, { type: "array" });
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        success: false,
        structureError: {
          missingColumns: [],
          extraColumns: [],
          customMessage: "Không thể đọc file. Định dạng file có thể bị hỏng hoặc không phải là file Excel hợp lệ."
        },
        rows: [],
        summary: { total: 0, valid: 0, duplicateInFile: 0, duplicateExisting: 0, invalid: 0 }
      };
    }
  } catch {
    return {
      success: false,
      structureError: {
        missingColumns: [],
        extraColumns: [],
        customMessage: "Không thể đọc file. Định dạng file có thể bị hỏng hoặc không phải là file Excel hợp lệ."
      },
      rows: [],
      summary: { total: 0, valid: 0, duplicateInFile: 0, duplicateExisting: 0, invalid: 0 }
    };
  }

  // 1. Check for "Vocabulary" sheet
  const vocabSheet = workbook.Sheets[VOCAB_SHEET_NAME];
  if (!vocabSheet) {
    return {
      success: false,
      structureError: {
        invalidSheet: true,
        missingColumns: [],
        extraColumns: [],
        customMessage: `Không tìm thấy sheet "${VOCAB_SHEET_NAME}". Vui lòng sử dụng file mẫu được tải từ Vibe English.`
      },
      rows: [],
      summary: { total: 0, valid: 0, duplicateInFile: 0, duplicateExisting: 0, invalid: 0 }
    };
  }

  // 2. Read sheet rows (as 2D array)
  const rawRows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(vocabSheet, {
    header: 1,
    defval: ""
  });

  if (!rawRows || rawRows.length === 0) {
    return {
      success: false,
      structureError: {
        emptyFile: true,
        missingColumns: [...VOCAB_IMPORT_COLUMNS],
        extraColumns: [],
        customMessage: 'File không có dữ liệu hoặc sheet "Vocabulary" bị rỗng.'
      },
      rows: [],
      summary: { total: 0, valid: 0, duplicateInFile: 0, duplicateExisting: 0, invalid: 0 }
    };
  }

  // 3. Validate Header Row (Row 1)
  const headerValidation = validateWorksheetHeaders(rawRows[0] || []);
  if (!headerValidation.isValid || !headerValidation.columnIndexes) {
    return {
      success: false,
      structureError: headerValidation.structureError,
      rows: [],
      summary: { total: 0, valid: 0, duplicateInFile: 0, duplicateExisting: 0, invalid: 0 }
    };
  }

  const colIdx = headerValidation.columnIndexes;

  // 4. Extract data rows (starting at index 1 -> Excel row 2)
  interface RawDataRow {
    excelRowNumber: number;
    word: string;
    definition: string;
    partOfSpeech: string;
    phonetic: string;
    topicName: string;
  }

  const dataRows: RawDataRow[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i] || [];
    const word = String(row[colIdx.word] ?? "").trim();
    const definition = String(row[colIdx.definition] ?? "").trim();
    const partOfSpeech = String(row[colIdx.partOfSpeech] ?? "").trim();
    const phonetic = String(row[colIdx.phonetic] ?? "").trim();
    const topicName = String(row[colIdx.topic] ?? "").trim();

    // Ignore completely empty rows (common at bottom of Excel files)
    const isCompletelyEmpty =
      !word && !definition && !partOfSpeech && !phonetic && !topicName;
    if (isCompletelyEmpty) {
      continue;
    }

    dataRows.push({
      excelRowNumber: i + 1, // 1-indexed Excel row
      word,
      definition,
      partOfSpeech,
      phonetic,
      topicName
    });
  }

  // Check max rows limit
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      success: false,
      structureError: {
        exceededMaxRows: true,
        missingColumns: [],
        extraColumns: [],
        customMessage: `File chứa quá nhiều dữ liệu (${dataRows.length} dòng). Vui lòng giới hạn tối đa ${MAX_IMPORT_ROWS} từ cho mỗi lần import.`
      },
      rows: [],
      summary: { total: dataRows.length, valid: 0, duplicateInFile: 0, duplicateExisting: 0, invalid: 0 }
    };
  }

  if (dataRows.length === 0) {
    return {
      success: false,
      structureError: {
        emptyFile: true,
        missingColumns: [],
        extraColumns: [],
        customMessage: 'Không tìm thấy dữ liệu từ vựng nào trong sheet "Vocabulary".'
      },
      rows: [],
      summary: { total: 0, valid: 0, duplicateInFile: 0, duplicateExisting: 0, invalid: 0 }
    };
  }

  // 5. Build lookup mappings
  // Topic mapping: lowercase name -> topicId
  const topicMap = new Map<string, string>();
  userTopics.forEach((t) => {
    topicMap.set(t.name.trim().toLowerCase(), t.id);
  });

  // DB existing vocabularies normalized word lookup
  const existingDbWords = new Set<string>();
  existingVocabularies.forEach((v) => {
    const norm = v.normalizedWord || normalizeVocabularyWord(v.word);
    if (norm) existingDbWords.add(norm);
  });

  // Intra-file duplicate tracking: normalizedWord -> first seen Excel row number
  const seenInFileMap = new Map<string, number>();

  const processedRows: ProcessedImportRow[] = [];
  let validCount = 0;
  let duplicateInFileCount = 0;
  let duplicateExistingCount = 0;
  let invalidCount = 0;

  // 6. Process each row
  dataRows.forEach((row) => {
    const errors: string[] = [];
    const normalized = normalizeVocabularyWord(row.word);

    // Validate word
    if (!row.word) {
      errors.push("Từ tiếng Anh không được để trống");
    } else if (row.word.length > 100) {
      errors.push("Từ tiếng Anh không được vượt quá 100 ký tự");
    }

    // Validate definition
    if (!row.definition) {
      errors.push("Định nghĩa tiếng Việt không được để trống");
    } else if (row.definition.length > 500) {
      errors.push("Định nghĩa không được vượt quá 500 ký tự");
    }

    // Validate partOfSpeech
    let cleanPartOfSpeech = "";
    if (row.partOfSpeech) {
      const normalizedPos = normalizePartOfSpeech(row.partOfSpeech);
      if (!normalizedPos) {
        errors.push(
          `Loại từ "${row.partOfSpeech}" không hợp lệ. Chỉ chấp nhận: ${PART_OF_SPEECH_OPTIONS.join(", ")}`
        );
      } else {
        cleanPartOfSpeech = normalizedPos;
      }
    }

    // Validate phonetic
    if (row.phonetic && row.phonetic.length > 100) {
      errors.push("Phiên âm không được vượt quá 100 ký tự");
    }

    // Resolve Topic
    let resolvedTopicId: string | null = null;
    if (row.topicName) {
      const matchedId = topicMap.get(row.topicName.toLowerCase());
      if (matchedId) {
        resolvedTopicId = matchedId;
      } else {
        errors.push(`Chủ đề "${row.topicName}" không tồn tại trong danh sách chủ đề của bạn`);
      }
    }

    // Determine row status & duplicates
    let status: ImportRowStatus = "valid";

    if (errors.length > 0) {
      status = "invalid";
      invalidCount++;
    } else if (normalized && seenInFileMap.has(normalized)) {
      status = "duplicate-in-file";
      const previousRow = seenInFileMap.get(normalized);
      errors.push(`Trùng với dòng ${previousRow} trong file`);
      duplicateInFileCount++;
    } else if (normalized && existingDbWords.has(normalized)) {
      status = "duplicate-existing";
      errors.push("Từ này đã có trong từ điển của bạn");
      duplicateExistingCount++;
    } else {
      status = "valid";
      validCount++;
      if (normalized) {
        seenInFileMap.set(normalized, row.excelRowNumber);
      }
    }

    processedRows.push({
      rowNumber: row.excelRowNumber,
      word: row.word,
      normalizedWord: normalized,
      definition: row.definition,
      partOfSpeech: cleanPartOfSpeech || row.partOfSpeech,
      phonetic: row.phonetic,
      topicName: row.topicName,
      topicId: resolvedTopicId,
      status,
      errors
    });
  });

  return {
    success: true,
    rows: processedRows,
    summary: {
      total: dataRows.length,
      valid: validCount,
      duplicateInFile: duplicateInFileCount,
      duplicateExisting: duplicateExistingCount,
      invalid: invalidCount
    }
  };
}
