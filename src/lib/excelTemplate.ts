import * as XLSX from "xlsx";
import {
  GUIDE_SHEET_NAME,
  PART_OF_SPEECH_OPTIONS,
  TEMPLATE_FILE_NAME,
  VOCAB_IMPORT_COLUMNS,
  VOCAB_SHEET_NAME
} from "@/constants/vocab";

/**
 * Generates an Excel Workbook object containing:
 * 1. "Vocabulary" sheet with fixed headers for user data entry.
 * 2. "HuongDan" sheet with instructions, allowed enum values, and sample illustrations.
 */
export function generateVocabularyTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // 1. Vocabulary Sheet (clean headers, no sample data rows to prevent accidental imports)
  const vocabHeaders = [...VOCAB_IMPORT_COLUMNS];
  const vocabWs = XLSX.utils.aoa_to_sheet([vocabHeaders]);

  // Set friendly column widths
  vocabWs["!cols"] = [
    { wch: 22 }, // word
    { wch: 38 }, // definition
    { wch: 16 }, // partOfSpeech
    { wch: 20 }, // phonetic
    { wch: 22 }  // topic
  ];

  XLSX.utils.book_append_sheet(wb, vocabWs, VOCAB_SHEET_NAME);

  // 2. HuongDan (Instructions) Sheet
  const guideData = [
    ["HƯỚNG DẪN ĐIỀN DỮ LIỆU TỪ VỰNG - VIBE ENGLISH"],
    [],
    ["1. QUY TẮC CHUNG:"],
    ["- Điền dữ liệu từ vựng vào sheet 'Vocabulary' (bắt đầu từ dòng thứ 2)."],
    ["- KHÔNG đổi tên sheet 'Vocabulary', không thêm cột, không xóa cột, không đổi tên cột."],
    ["- Mỗi dòng tương ứng với 1 từ vựng. Các dòng trống hoàn toàn sẽ tự động được bỏ qua."],
    ["- Hệ thống hỗ trợ tối đa 500 từ vựng cho mỗi lần import."],
    [],
    ["2. QUY ĐỊNH CHI TIẾT TỪNG CỘT:"],
    ["Cột", "Bắt buộc?", "Quy tắc & Định dạng hợp lệ"],
    ["word", "CÓ", "Từ vựng tiếng Anh (tối đa 100 ký tự)."],
    ["definition", "CÓ", "Định nghĩa / Nghĩa tiếng Việt (tối đa 500 ký tự)."],
    ["partOfSpeech", "KHÔNG", `Loại từ. Chỉ chấp nhận các giá trị: ${PART_OF_SPEECH_OPTIONS.join(", ")}`],
    ["phonetic", "KHÔNG", "Phiên âm IPA (ví dụ: /ˈæp.əl/)."],
    ["topic", "KHÔNG", "Tên chủ đề đã có trong Vibe English của bạn (ví dụ: Food, Work). Để trống = Chưa phân loại."],
    [],
    ["3. VÍ DỤ MINH HỌA (Xem mẫu, không copy vào sheet Vocabulary):"],
    ["word", "definition", "partOfSpeech", "phonetic", "topic"],
    ["apple", "quả táo", "noun", "/ˈæp.əl/", "Food"],
    ["resilient", "kiên cường, bền bỉ", "adjective", "/rɪˈzɪl.jənt/", "Personal"],
    ["improve", "cải thiện, trau dồi", "verb", "/ɪmˈpruːv/", ""],
    ["quickly", "một cách nhanh chóng", "adverb", "/ˈkwɪk.li/", "Daily"],
    ["under", "ở dưới", "prep", "/ˈʌn.dər/", "Grammar"]
  ];

  const guideWs = XLSX.utils.aoa_to_sheet(guideData);
  guideWs["!cols"] = [
    { wch: 18 },
    { wch: 35 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 }
  ];

  XLSX.utils.book_append_sheet(wb, guideWs, GUIDE_SHEET_NAME);

  return wb;
}

/**
 * Generates and triggers browser download of the standard Excel template file.
 */
export function downloadVocabularyTemplate(fileName: string = TEMPLATE_FILE_NAME): void {
  const wb = generateVocabularyTemplateWorkbook();
  const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbOut], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
