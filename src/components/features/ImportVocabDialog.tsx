import { useId, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  UploadCloud,
  X,
  XCircle
} from "lucide-react";
import { toast } from "sonner";

import { TopicFilterSelect } from "@/components/features/TopicFilterSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MAX_IMPORT_FILE_SIZE_BYTES } from "@/constants/vocab";
import { analyzeBulkItems, parseBulkText } from "@/lib/bulkParser";
import { parseAndValidateExcelFile } from "@/lib/excelParser";
import { downloadVocabularyTemplate } from "@/lib/excelTemplate";
import { cn } from "@/lib/utils";
import { batchCreateVocabularies } from "@/services/vocabularyRepository";
import type {
  AnalyzedBulkRow,
  ImportAnalysisResult,
  ImportRowStatus,
  ProcessedImportRow,
  Topic,
  Vocabulary
} from "@/types/types";

interface ImportVocabDialogProps {
  onClose: () => void;
  userId: string;
  topics: Topic[];
  vocabularies: Vocabulary[];
}

type ImportTab = "excel" | "paste";
type PreviewFilterOption = "all" | "valid" | "duplicate" | "invalid";

export function ImportVocabDialog({
  onClose,
  userId,
  topics,
  vocabularies
}: ImportVocabDialogProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<ImportTab>("excel");

  // Excel mode state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [excelResult, setExcelResult] = useState<ImportAnalysisResult | null>(null);

  // Paste mode state
  const [rawText, setRawText] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState<{ current: number; total: number } | null>(null);
  const [enrichedOverrides, setEnrichedOverrides] = useState<Map<string, Partial<AnalyzedBulkRow>>>(
    new Map()
  );

  // Common UI state
  const [previewFilter, setPreviewFilter] = useState<PreviewFilterOption>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset Excel state
  const resetExcelState = () => {
    setSelectedFile(null);
    setExcelResult(null);
    setPreviewFilter("all");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Reset Paste state
  const resetPasteState = () => {
    setRawText("");
    setEnrichedOverrides(new Map());
    setPreviewFilter("all");
  };

  // Tab change handler
  const handleTabChange = (val: string) => {
    setActiveTab(val as ImportTab);
    setPreviewFilter("all");
  };

  // Download template
  const handleDownloadTemplate = () => {
    try {
      downloadVocabularyTemplate();
      toast.success("Đã tải file mẫu! Hãy điền từ vựng vào sheet 'Vocabulary'.");
    } catch {
      toast.error("Không thể tải file mẫu. Vui lòng thử lại.");
    }
  };

  // Process uploaded Excel file
  const processExcelFile = async (file: File) => {
    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      toast.error("Dung lượng file vượt quá giới hạn 5 MB.");
      return;
    }

    setSelectedFile(file);
    setIsParsingExcel(true);
    setExcelResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = parseAndValidateExcelFile(arrayBuffer, vocabularies, topics);
      setExcelResult(result);

      if (result.success) {
        if (result.summary.valid > 0) {
          toast.success(
            `Đã phân tích ${result.summary.total} dòng: ${result.summary.valid} từ hợp lệ sẵn sàng import!`
          );
        } else {
          toast.warning(`Không có từ nào hợp lệ để import trong số ${result.summary.total} dòng.`);
        }
      } else {
        toast.error("File không đúng cấu trúc mẫu. Vui lòng kiểm tra lại cấu trúc.");
      }
    } catch {
      toast.error("Lỗi khi xử lý file Excel.");
    } finally {
      setIsParsingExcel(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processExcelFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Parse and analyze Paste mode items
  const pasteItems = useMemo(() => {
    if (activeTab !== "paste") return [];
    return parseBulkText(rawText, selectedTopicId);
  }, [activeTab, rawText, selectedTopicId]);

  const pasteAnalysis = useMemo(() => {
    if (activeTab !== "paste") return null;
    const analysis = analyzeBulkItems(pasteItems, vocabularies);
    const updatedRows = analysis.rows.map((row) => {
      const override = enrichedOverrides.get(row.rawId);
      if (override) {
        return { ...row, ...override };
      }
      return row;
    });

    // Map AnalyzedBulkRow to unified ProcessedImportRow
    const processedRows: ProcessedImportRow[] = updatedRows.map((r, idx) => {
      let status: ImportRowStatus = "valid";
      const errors: string[] = [];

      if (r.status === "duplicate_in_file") {
        status = "duplicate-in-file";
        errors.push(r.errorMessage || "Trùng trong danh sách");
      } else if (r.status === "duplicate_in_db") {
        status = "duplicate-existing";
        errors.push(r.errorMessage || "Đã có trong từ điển");
      } else if (r.status === "invalid") {
        status = "invalid";
        errors.push(r.errorMessage || "Lỗi dữ liệu");
      }

      return {
        rowNumber: idx + 1,
        word: r.word,
        normalizedWord: r.normalizedWord,
        definition: r.definition || "",
        partOfSpeech: r.partOfSpeech || "",
        phonetic: r.phonetic || "",
        topicName: r.topicName || "",
        topicId: r.topicId || null,
        status,
        errors
      };
    });

    return {
      rows: processedRows,
      summary: {
        total: analysis.summary.total,
        valid: analysis.summary.valid,
        duplicateInFile: analysis.summary.duplicateInFile,
        duplicateExisting: analysis.summary.duplicateInDb,
        invalid: analysis.summary.invalid
      }
    };
  }, [activeTab, pasteItems, vocabularies, enrichedOverrides]);

  // AI Batch lookup for paste mode
  const handleAiBatchEnrich = async () => {
    if (!pasteAnalysis) return;
    const validRows = pasteAnalysis.rows.filter((r) => r.status === "valid");
    const targetRows = validRows.filter((r) => !r.definition || r.definition.trim() === "");
    const rowsToEnrich = targetRows.length > 0 ? targetRows : validRows;

    if (rowsToEnrich.length === 0) {
      toast.info("Không có từ hợp lệ nào cần tra cứu AI.");
      return;
    }

    const wordsToFetch = rowsToEnrich.map((r) => r.word);
    setIsAiLoading(true);
    setAiProgress({ current: 0, total: wordsToFetch.length });

    try {
      const { getBatchWordDetails } = await import("@/services/geminiService");
      const detailsList = await getBatchWordDetails(wordsToFetch, (current, total) => {
        setAiProgress({ current, total });
      });

      const newOverrides = new Map(enrichedOverrides);
      rowsToEnrich.forEach((row) => {
        const detail = detailsList.find(
          (d) => d.word.toLowerCase().trim() === row.word.toLowerCase().trim()
        );
        if (detail) {
          const itemKey = pasteItems[row.rowNumber - 1]?.rawId;
          if (itemKey) {
            newOverrides.set(itemKey, {
              definition: detail.definition || row.definition || "",
              partOfSpeech: detail.partOfSpeech || row.partOfSpeech || "",
              phonetic: detail.phonetic || row.phonetic || ""
            });
          }
        }
      });

      setEnrichedOverrides(newOverrides);
      toast.success(`Đã hoàn tất tra cứu AI cho ${detailsList.length} từ! ✨`);
    } catch {
      toast.error("Không thể hoàn tất tra cứu AI. Vui lòng thử lại sau.");
    } finally {
      setIsAiLoading(false);
      setAiProgress(null);
    }
  };

  // Active dataset depending on selected tab
  const activeDataset = useMemo(() => {
    if (activeTab === "excel") {
      return excelResult?.success ? excelResult : null;
    } else {
      return pasteAnalysis && pasteAnalysis.rows.length > 0 ? pasteAnalysis : null;
    }
  }, [activeTab, excelResult, pasteAnalysis]);

  // Filtered rows for table preview
  const filteredRows = useMemo(() => {
    if (!activeDataset || !activeDataset.rows) return [];
    if (previewFilter === "all") return activeDataset.rows;
    if (previewFilter === "valid") return activeDataset.rows.filter((r) => r.status === "valid");
    if (previewFilter === "duplicate") {
      return activeDataset.rows.filter(
        (r) => r.status === "duplicate-in-file" || r.status === "duplicate-existing"
      );
    }
    if (previewFilter === "invalid") return activeDataset.rows.filter((r) => r.status === "invalid");
    return activeDataset.rows;
  }, [activeDataset, previewFilter]);

  const validRowsToSubmit = useMemo(() => {
    return activeDataset?.rows.filter((r) => r.status === "valid") ?? [];
  }, [activeDataset]);

  // Batch import submission
  const handleImportSubmit = async () => {
    if (validRowsToSubmit.length === 0) {
      toast.error("Không có từ vựng hợp lệ nào để lưu.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = validRowsToSubmit.map((r) => ({
        word: r.word,
        definition: r.definition || "Chưa có định nghĩa",
        partOfSpeech: r.partOfSpeech || null,
        phonetic: r.phonetic || null,
        topicId: r.topicId || (selectedTopicId || null)
      }));

      const result = await batchCreateVocabularies(userId, payload);
      toast.success(`Đã thêm thành công ${result.successCount} từ vựng vào từ điển! 🎉`);
      onClose();
    } catch {
      toast.error("Đã xảy ra lỗi khi lưu danh sách từ vựng vào hệ thống.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: ImportRowStatus, errors: string[]) => {
    switch (status) {
      case "valid":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#10b981] bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-emerald-200/60">
            <CheckCircle2 className="w-3 h-3 text-[#10b981] shrink-0" />
            Hợp lệ
          </span>
        );
      case "duplicate-in-file":
        return (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60"
            title={errors.join(", ")}
          >
            <Copy className="w-3 h-3 text-amber-600 shrink-0" />
            Trùng trong file
          </span>
        );
      case "duplicate-existing":
        return (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60"
            title={errors.join(", ")}
          >
            <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
            Đã có trong từ điển
          </span>
        );
      case "invalid":
        return (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60"
            title={errors.join(", ")}
          >
            <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
            Có lỗi
          </span>
        );
    }
  };

  return (
    <DialogContent
      className={cn(
        "sm:max-w-4xl max-h-[92dvh] flex flex-col p-0 rounded-3xl overflow-hidden border-none shadow-2xl transition-all",
        activeDataset ? "h-[90dvh]" : "h-auto"
      )}
    >
      {/* Header */}
      <DialogHeader className="bg-[#10b981] p-5 sm:p-6 text-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <UploadCloud className="w-6 h-6 text-emerald-200 shrink-0" />
              Nhập từ vựng hàng loạt
            </DialogTitle>
            <p className="text-emerald-100 text-xs sm:text-sm font-medium mt-1">
              Thêm nhanh nhiều từ vựng bằng file mẫu Excel hoặc dán văn bản trực tiếp
            </p>
          </div>
          <Badge className="hidden sm:inline-flex bg-white/20 text-white hover:bg-white/30 border-none font-semibold px-3 py-1 text-xs">
            Batch Import
          </Badge>
        </div>
      </DialogHeader>

      {/* Main Body */}
      <div className="p-4 sm:p-6 space-y-4 flex-1 min-h-0 overflow-y-auto flex flex-col bg-white">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="shrink-0 flex flex-col">
          <TabsList className="grid grid-cols-2 bg-slate-100 p-1 rounded-2xl shrink-0 h-11 mb-3">
            <TabsTrigger
              value="excel"
              className="rounded-xl font-bold text-xs sm:text-sm py-2 flex items-center justify-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#10b981] shrink-0" />
              File mẫu Excel (.xlsx)
            </TabsTrigger>
            <TabsTrigger
              value="paste"
              className="rounded-xl font-bold text-xs sm:text-sm py-2 flex items-center justify-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-[#10b981] shrink-0" />
              Dán văn bản nhanh
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: EXCEL TEMPLATE */}
          <TabsContent value="excel" className="space-y-4 m-0 shrink-0 flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Step 1: Download Template */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-2.5">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#10b981] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      1
                    </span>
                    <h3 className="font-bold text-slate-800 text-sm">Tải file mẫu chuẩn</h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Tải file mẫu của Vibe English, điền từ vựng vào sheet{" "}
                    <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-700 font-semibold text-[11px]">
                      Vocabulary
                    </code>
                    , không sửa tên các cột.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  className="w-full bg-white hover:bg-[#ECFDF5] text-[#10b981] border-emerald-200 hover:border-[#10b981] font-semibold text-xs h-10 rounded-xl shadow-sm cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-[#10b981]" />
                  Tải file mẫu (.xlsx)
                </Button>
              </div>

              {/* Step 2: Upload File */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-2.5">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#10b981] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      2
                    </span>
                    <h3 className="font-bold text-slate-800 text-sm">Tải file đã điền lên</h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Hệ thống sẽ tự động kiểm tra cấu trúc, phát hiện lỗi và từ trùng lặp trước khi lưu.
                  </p>
                </div>

                <input
                  id={fileInputId}
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-sm h-10">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <FileSpreadsheet className="w-4 h-4 text-[#10b981] shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 truncate" title={selectedFile.name}>
                        {selectedFile.name}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetExcelState}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0 cursor-pointer"
                      title="Chọn file khác"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className="border-2 border-dashed border-slate-300 hover:border-[#10b981] hover:bg-[#ECFDF5]/40 transition-all rounded-xl p-2 text-center cursor-pointer flex items-center justify-center gap-1.5 bg-white h-10"
                  >
                    <UploadCloud className="w-4 h-4 text-[#10b981] shrink-0" />
                    <span className="text-xs font-semibold text-slate-700">
                      Chọn hoặc kéo thả file .xlsx vào đây
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Excel Loading State */}
            {isParsingExcel && (
              <div className="py-6 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-100">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#10b981]" />
                <p className="text-xs font-semibold text-slate-600">
                  Đang phân tích cấu trúc file Excel và kiểm tra trùng lặp...
                </p>
              </div>
            )}

            {/* Excel Structural Error Alert */}
            {excelResult && !excelResult.success && excelResult.structureError && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <h4 className="font-bold text-rose-900 text-sm">
                      File không đúng cấu trúc mẫu chuẩn
                    </h4>
                    <p className="text-xs text-rose-700 leading-relaxed">
                      {excelResult.structureError.customMessage ||
                        "Cấu trúc các cột trong file không khớp với file mẫu của Vibe English."}
                    </p>

                    {excelResult.structureError.missingColumns &&
                      excelResult.structureError.missingColumns.length > 0 && (
                        <div className="mt-1.5 text-xs text-rose-800">
                          <span className="font-semibold">Thiếu các cột bắt buộc: </span>
                          <span className="font-mono font-bold">
                            {excelResult.structureError.missingColumns.join(", ")}
                          </span>
                        </div>
                      )}

                    {excelResult.structureError.extraColumns &&
                      excelResult.structureError.extraColumns.length > 0 && (
                        <div className="mt-1 text-xs text-rose-800">
                          <span className="font-semibold">Cột lạ không được hỗ trợ: </span>
                          <span className="font-mono font-bold">
                            {excelResult.structureError.extraColumns.join(", ")}
                          </span>
                        </div>
                      )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadTemplate}
                    className="text-xs font-semibold border-rose-300 text-rose-800 hover:bg-rose-100/60 rounded-lg h-8"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Tải lại file mẫu mới nhất
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: PASTE TEXT */}
          <TabsContent value="paste" className="space-y-3.5 m-0 shrink-0 flex flex-col">
            {/* Topic Selector Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Gán chủ đề mặc định:
                </span>
              </div>
              <TopicFilterSelect
                value={selectedTopicId}
                onValueChange={setSelectedTopicId}
                topics={topics}
                vocabularies={vocabularies}
                showAllOption={false}
                unassignedValue=""
                placeholder="Chưa phân loại"
                variant="form"
                className="w-full sm:w-64 h-9 text-xs"
              />
            </div>

            {/* Textarea */}
            <div className="relative">
              <textarea
                placeholder={`Nhập hoặc dán các từ, mỗi từ một dòng:&#10;apple | quả táo | noun | /ˈæp.əl/&#10;banana | quả chuối&#10;orange&#10;computer | máy tính | noun | /kəmˈpjuː.tər/ | Technology`}
                className="w-full h-24 sm:h-28 p-3 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#10b981] font-mono resize-none leading-relaxed"
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  setEnrichedOverrides(new Map());
                }}
              />
              {rawText && (
                <button
                  type="button"
                  onClick={resetPasteState}
                  className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Xóa nội dung"
                  aria-label="Xóa nội dung"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                Cú pháp: <code>word</code> hoặc <code>word | definition | partOfSpeech | phonetic</code>
              </span>

              {pasteAnalysis && pasteAnalysis.rows.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAiBatchEnrich}
                  disabled={isAiLoading || validRowsToSubmit.length === 0}
                  className="border-emerald-200 text-[#10b981] bg-[#ECFDF5] hover:bg-[#ECFDF5]/80 rounded-lg text-xs font-semibold h-8 shrink-0 cursor-pointer self-start sm:self-auto"
                >
                  {isAiLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      {aiProgress ? `Đang tra (${aiProgress.current}/${aiProgress.total})...` : "Đang tra AI..."}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 mr-1.5 text-[#10b981]" />
                      AI tra cứu tự động từ thiếu nghĩa
                    </>
                  )}
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* COMMON PREVIEW & ANALYSIS SECTION */}
        {activeDataset && (
          <div className="flex-1 min-h-0 flex flex-col space-y-2.5 pt-2 border-t border-slate-100">
            {/* Summary Counters & Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80 shrink-0">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewFilter("all")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    previewFilter === "all"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  Tất cả: {activeDataset.summary.total}
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewFilter("valid")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    previewFilter === "valid"
                      ? "bg-[#10b981] text-white shadow-sm"
                      : "bg-[#ECFDF5] text-[#10b981] hover:bg-[#ECFDF5]/80 border border-emerald-200/60"
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {activeDataset.summary.valid} hợp lệ
                </button>

                {(activeDataset.summary.duplicateInFile > 0 ||
                  activeDataset.summary.duplicateExisting > 0) && (
                  <button
                    type="button"
                    onClick={() => setPreviewFilter("duplicate")}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                      previewFilter === "duplicate"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60"
                    }`}
                  >
                    <Copy className="w-3 h-3" />
                    {activeDataset.summary.duplicateInFile +
                      activeDataset.summary.duplicateExisting}{" "}
                    trùng lặp
                  </button>
                )}

                {activeDataset.summary.invalid > 0 && (
                  <button
                    type="button"
                    onClick={() => setPreviewFilter("invalid")}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                      previewFilter === "invalid"
                        ? "bg-rose-700 text-white shadow-sm"
                        : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60"
                    }`}
                  >
                    <X className="w-3 h-3" />
                    {activeDataset.summary.invalid} có lỗi
                  </button>
                )}
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                Chỉ các dòng hợp lệ mới được lưu
              </div>
            </div>

            {/* Preview Table Container */}
            <div className="flex-1 min-h-[160px] border border-slate-200 rounded-2xl bg-white flex flex-col overflow-hidden">
              {/* Table Header */}
              <div className="bg-slate-100/90 px-3 sm:px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 grid grid-cols-12 gap-2 shrink-0 border-b border-slate-200">
                <span className="col-span-1 text-center">#</span>
                <span className="col-span-3 sm:col-span-3">Từ tiếng Anh</span>
                <span className="col-span-4 sm:col-span-3">Định nghĩa</span>
                <span className="hidden sm:inline sm:col-span-2">Loại từ / Chủ đề</span>
                <span className="col-span-4 sm:col-span-3 text-right sm:text-left">Trạng thái</span>
              </div>

              {/* Table Rows */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="divide-y divide-slate-100 text-xs">
                  {filteredRows.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      Không có dòng nào thuộc bộ lọc này.
                    </div>
                  ) : (
                    filteredRows.map((row) => (
                      <div
                        key={`row-${row.rowNumber}-${row.word}`}
                        className={`px-3 sm:px-4 py-2 grid grid-cols-12 gap-2 items-center transition-colors ${
                          row.status === "valid"
                            ? "hover:bg-slate-50"
                            : row.status === "invalid"
                              ? "bg-rose-50/40 hover:bg-rose-50/60"
                              : "bg-amber-50/40 hover:bg-amber-50/60"
                        }`}
                      >
                        {/* Row Number */}
                        <div className="col-span-1 text-center font-mono text-[11px] text-slate-400 font-semibold">
                          {row.rowNumber}
                        </div>

                        {/* Word */}
                        <div className="col-span-3 sm:col-span-3 font-semibold text-slate-800 truncate">
                          <span>{row.word || <span className="text-rose-400 italic">(Trống)</span>}</span>
                          {row.phonetic && (
                            <span className="block text-[10px] text-slate-400 font-mono font-normal truncate">
                              /{row.phonetic}/
                            </span>
                          )}
                        </div>

                        {/* Definition */}
                        <div className="col-span-4 sm:col-span-3 text-slate-600 truncate">
                          {row.definition || (
                            <span className="text-rose-400 italic">(Chưa có nghĩa)</span>
                          )}
                        </div>

                        {/* PartOfSpeech / Topic */}
                        <div className="hidden sm:inline sm:col-span-2 text-slate-500 text-[11px] truncate">
                          {row.partOfSpeech && (
                            <span className="font-semibold text-slate-600 mr-1">
                              [{row.partOfSpeech}]
                            </span>
                          )}
                          <span>
                            {row.topicName ||
                              (selectedTopicId
                                ? topics.find((t) => t.id === selectedTopicId)?.name
                                : null) || <span className="text-slate-400">Chưa phân loại</span>}
                          </span>
                        </div>

                        {/* Status & Error Details */}
                        <div className="col-span-4 sm:col-span-3 flex flex-col items-end sm:items-start justify-center">
                          {getStatusBadge(row.status, row.errors)}
                          {row.errors.length > 0 && (
                            <span
                              className="text-[10px] text-slate-500 mt-0.5 line-clamp-1"
                              title={row.errors.join(", ")}
                            >
                              {row.errors.join("; ")}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <DialogFooter className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isSubmitting}
          className="rounded-xl text-slate-500 font-medium h-11"
        >
          Đóng
        </Button>

        <div className="flex items-center gap-2">
          {activeTab === "excel" && selectedFile && (
            <Button
              type="button"
              variant="outline"
              onClick={resetExcelState}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-semibold h-11 px-3 border-slate-200 hover:bg-slate-100"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1 text-slate-500" />
              Chọn file khác
            </Button>
          )}

          <Button
            type="button"
            onClick={handleImportSubmit}
            disabled={isSubmitting || validRowsToSubmit.length === 0}
            className="bg-[#10b981] hover:bg-[#10b981]/90 text-white rounded-xl px-6 font-semibold shadow-md shadow-[#10b981]/20 h-11 min-h-[44px] cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang lưu {validRowsToSubmit.length} từ...
              </>
            ) : validRowsToSubmit.length > 0 ? (
              `Import ${validRowsToSubmit.length} từ hợp lệ`
            ) : (
              "Import từ vựng"
            )}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}
