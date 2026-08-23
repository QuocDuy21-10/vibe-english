import { useId, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  HelpCircle,
  Loader2,
  RefreshCw,
  UploadCloud,
  X,
  XCircle
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MAX_IMPORT_FILE_SIZE_BYTES } from "@/constants/vocab";
import { parseAndValidateExcelFile } from "@/lib/excelParser";
import { downloadVocabularyTemplate } from "@/lib/excelTemplate";
import { batchCreateVocabularies } from "@/services/vocabularyRepository";
import type {
  ImportAnalysisResult,
  ImportRowStatus,
  Topic,
  Vocabulary
} from "@/types/types";

interface ImportVocabDialogProps {
  onClose: () => void;
  userId: string;
  topics: Topic[];
  vocabularies: Vocabulary[];
}

type PreviewFilterOption = "all" | "valid" | "duplicate" | "invalid";

export function ImportVocabDialog({
  onClose,
  userId,
  topics,
  vocabularies
}: ImportVocabDialogProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ImportAnalysisResult | null>(null);
  const [previewFilter, setPreviewFilter] = useState<PreviewFilterOption>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetState = () => {
    setSelectedFile(null);
    setAnalysisResult(null);
    setPreviewFilter("all");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    try {
      downloadVocabularyTemplate();
      toast.success("Đã tải file mẫu! Hãy điền từ vựng vào sheet 'Vocabulary'.");
    } catch {
      toast.error("Không thể tải file mẫu. Vui lòng thử lại.");
    }
  };

  const processFile = async (file: File) => {
    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      toast.error("Dung lượng file vượt quá giới hạn 5 MB.");
      return;
    }

    setSelectedFile(file);
    setIsParsing(true);
    setAnalysisResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = parseAndValidateExcelFile(arrayBuffer, vocabularies, topics);
      setAnalysisResult(result);

      if (result.success) {
        if (result.summary.valid > 0) {
          toast.success(`Đã phân tích ${result.summary.total} dòng: ${result.summary.valid} từ hợp lệ sẵn sàng import!`);
        } else {
          toast.warning(`Không có từ nào hợp lệ để import trong số ${result.summary.total} dòng.`);
        }
      } else {
        toast.error("File không đúng cấu trúc mẫu. Vui lòng kiểm tra lại cấu trúc.");
      }
    } catch {
      toast.error("Lỗi khi xử lý file Excel.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Filtered rows for preview table
  const filteredRows = useMemo(() => {
    if (!analysisResult || !analysisResult.rows) return [];
    if (previewFilter === "all") return analysisResult.rows;
    if (previewFilter === "valid") return analysisResult.rows.filter((r) => r.status === "valid");
    if (previewFilter === "duplicate") {
      return analysisResult.rows.filter(
        (r) => r.status === "duplicate-in-file" || r.status === "duplicate-existing"
      );
    }
    if (previewFilter === "invalid") return analysisResult.rows.filter((r) => r.status === "invalid");
    return analysisResult.rows;
  }, [analysisResult, previewFilter]);

  const validRows = useMemo(() => {
    return analysisResult?.rows.filter((r) => r.status === "valid") ?? [];
  }, [analysisResult]);

  const handleImportSubmit = async () => {
    if (validRows.length === 0) {
      toast.error("Không có từ vựng hợp lệ nào để lưu.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = validRows.map((r) => ({
        word: r.word,
        definition: r.definition,
        partOfSpeech: r.partOfSpeech || null,
        phonetic: r.phonetic || null,
        topicId: r.topicId || null
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
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            Hợp lệ
          </span>
        );
      case "duplicate-in-file":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60" title={errors.join(", ")}>
            <Copy className="w-3 h-3 text-amber-600 shrink-0" />
            Trùng trong file
          </span>
        );
      case "duplicate-existing":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60" title={errors.join(", ")}>
            <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
            Đã có trong từ điển
          </span>
        );
      case "invalid":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60" title={errors.join(", ")}>
            <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
            Có lỗi
          </span>
        );
    }
  };

  return (
    <DialogContent className="sm:max-w-4xl max-h-[92dvh] flex flex-col p-0 rounded-3xl overflow-hidden border-none shadow-2xl">
      {/* Header */}
      <DialogHeader className="bg-[#006c49] p-5 sm:p-6 text-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-emerald-200 shrink-0" />
              Nhập từ vựng bằng file mẫu
            </DialogTitle>
            <p className="text-emerald-100 text-xs sm:text-sm font-medium mt-1">
              Tải file mẫu Excel chuẩn, điền dữ liệu và tải lên để thêm nhiều từ cùng lúc
            </p>
          </div>
          <Badge className="hidden sm:inline-flex bg-white/20 text-white hover:bg-white/30 border-none font-semibold px-3 py-1 text-xs">
            Excel .xlsx
          </Badge>
        </div>
      </DialogHeader>

      {/* Main Body */}
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 flex-1 overflow-y-auto flex flex-col bg-white">
        {/* Step 1 & Step 2 Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Step 1: Download Template */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#006c49] text-white text-xs font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                  Tải file mẫu chuẩn
                </h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tải file mẫu Excel của Vibe English. Điền từ vựng vào sheet{" "}
                <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 font-semibold">
                  Vocabulary
                </code>
                , không thay đổi cấu trúc các cột.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadTemplate}
              className="w-full bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-200 hover:border-emerald-500 font-semibold text-xs sm:text-sm h-11 rounded-xl shadow-sm cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              Tải file mẫu (.xlsx)
            </Button>
          </div>

          {/* Step 2: Upload File */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#006c49] text-white text-xs font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                  Tải file đã điền lên
                </h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Chọn file Excel đã hoàn thiện. Hệ thống sẽ tự động kiểm tra cấu trúc, phát hiện lỗi và từ trùng lặp trước khi import.
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
              <div className="flex items-center justify-between bg-white px-3.5 py-2 rounded-xl border border-emerald-200 shadow-sm">
                <div className="flex items-center gap-2 truncate pr-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-semibold text-slate-700 truncate" title={selectedFile.name}>
                    {selectedFile.name}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetState}
                  className="h-8 px-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0 cursor-pointer"
                  title="Chọn file khác"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-600 hover:bg-emerald-50/40 transition-all rounded-xl p-3 sm:p-4 text-center cursor-pointer flex items-center justify-center gap-2 bg-white"
              >
                <UploadCloud className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-xs font-semibold text-slate-700">
                  Chọn file hoặc kéo thả file vào đây
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isParsing && (
          <div className="py-8 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-100">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#006c49]" />
            <p className="text-xs font-semibold text-slate-600">
              Đang phân tích cấu trúc file và kiểm tra trùng lặp...
            </p>
          </div>
        )}

        {/* Structural Error Alert */}
        {analysisResult && !analysisResult.success && analysisResult.structureError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <h4 className="font-bold text-rose-900 text-sm">
                  File không đúng cấu trúc mẫu chuẩn
                </h4>
                <p className="text-xs text-rose-700 leading-relaxed">
                  {analysisResult.structureError.customMessage ||
                    "Cấu trúc các cột trong file không khớp với file mẫu của Vibe English. Vui lòng sử dụng file mẫu chuẩn."}
                </p>

                {/* Missing Columns */}
                {analysisResult.structureError.missingColumns &&
                  analysisResult.structureError.missingColumns.length > 0 && (
                    <div className="mt-2 text-xs text-rose-800">
                      <span className="font-semibold">Thiếu các cột bắt buộc:</span>
                      <ul className="list-disc list-inside ml-2 mt-0.5 space-y-0.5 font-mono text-[11px]">
                        {analysisResult.structureError.missingColumns.map((col) => (
                          <li key={col} className="font-bold">{col}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Extra Unsupported Columns */}
                {analysisResult.structureError.extraColumns &&
                  analysisResult.structureError.extraColumns.length > 0 && (
                    <div className="mt-2 text-xs text-rose-800">
                      <span className="font-semibold">Cột không được hỗ trợ trong template:</span>
                      <ul className="list-disc list-inside ml-2 mt-0.5 space-y-0.5 font-mono text-[11px]">
                        {analysisResult.structureError.extraColumns.map((col) => (
                          <li key={col} className="font-bold">{col}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleDownloadTemplate}
                className="text-xs font-semibold border-rose-300 text-rose-800 hover:bg-rose-100/60 rounded-lg h-9"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Tải lại file mẫu mới nhất
              </Button>
            </div>
          </div>
        )}

        {/* Successful Analysis & Preview */}
        {analysisResult && analysisResult.success && (
          <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
            {/* Summary Counters & Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 shrink-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewFilter("all")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    previewFilter === "all"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  Tất cả: {analysisResult.summary.total}
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewFilter("valid")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    previewFilter === "valid"
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {analysisResult.summary.valid} hợp lệ
                </button>

                {(analysisResult.summary.duplicateInFile > 0 ||
                  analysisResult.summary.duplicateExisting > 0) && (
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
                    {analysisResult.summary.duplicateInFile +
                      analysisResult.summary.duplicateExisting}{" "}
                    trùng lặp
                  </button>
                )}

                {analysisResult.summary.invalid > 0 && (
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
                    {analysisResult.summary.invalid} có lỗi
                  </button>
                )}
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                Chỉ các dòng hợp lệ mới được lưu
              </div>
            </div>

            {/* Preview Table Container */}
            <div className="flex-1 overflow-hidden border border-slate-200 rounded-2xl bg-white flex flex-col min-h-[180px] max-h-[280px] sm:max-h-[320px]">
              {/* Table Header */}
              <div className="bg-slate-100/90 px-3 sm:px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 grid grid-cols-12 gap-2 shrink-0 border-b border-slate-200">
                <span className="col-span-1 text-center">Dòng</span>
                <span className="col-span-3 sm:col-span-3">Từ tiếng Anh</span>
                <span className="col-span-4 sm:col-span-3">Định nghĩa</span>
                <span className="hidden sm:inline sm:col-span-2">Loại từ / Chủ đề</span>
                <span className="col-span-4 sm:col-span-3 text-right sm:text-left">Trạng thái</span>
              </div>

              {/* Table Rows */}
              <ScrollArea className="flex-1">
                <div className="divide-y divide-slate-100 text-xs">
                  {filteredRows.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      Không có dòng nào thuộc bộ lọc này.
                    </div>
                  ) : (
                    filteredRows.map((row) => (
                      <div
                        key={`row-${row.rowNumber}`}
                        className={`px-3 sm:px-4 py-2.5 grid grid-cols-12 gap-2 items-center transition-colors ${
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
                            <span className="text-rose-400 italic">(Trống)</span>
                          )}
                        </div>

                        {/* PartOfSpeech / Topic */}
                        <div className="hidden sm:inline sm:col-span-2 text-slate-500 text-[11px] truncate">
                          {row.partOfSpeech && (
                            <span className="font-semibold text-slate-600 mr-1">
                              [{row.partOfSpeech}]
                            </span>
                          )}
                          <span>{row.topicName || <span className="text-slate-400">Chưa phân loại</span>}</span>
                        </div>

                        {/* Status & Error Details */}
                        <div className="col-span-4 sm:col-span-3 flex flex-col items-end sm:items-start justify-center">
                          {getStatusBadge(row.status, row.errors)}
                          {row.errors.length > 0 && (
                            <span className="text-[10px] text-slate-500 mt-0.5 line-clamp-1" title={row.errors.join(", ")}>
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
          {analysisResult && (
            <Button
              type="button"
              variant="outline"
              onClick={resetState}
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
            disabled={isSubmitting || validRows.length === 0}
            className="bg-[#006c49] hover:bg-[#006c49]/90 text-white rounded-xl px-6 font-semibold shadow-md shadow-[#006c49]/20 h-11 min-h-[44px] cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang lưu {validRows.length} từ...
              </>
            ) : validRows.length > 0 ? (
              `Import ${validRows.length} từ hợp lệ`
            ) : (
              "Import từ vựng"
            )}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}
