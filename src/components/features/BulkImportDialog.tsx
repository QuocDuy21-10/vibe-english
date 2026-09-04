import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Loader2,
  Sparkles,
  Upload,
  X
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
import { analyzeBulkItems, parseBulkText, parseCsvContent } from "@/lib/bulkParser";
import { batchCreateVocabularies } from "@/services/vocabularyRepository";
import type { AnalyzedBulkRow, Topic, Vocabulary } from "@/types/types";

interface BulkImportDialogProps {
  onClose: () => void;
  userId: string;
  topics: Topic[];
  vocabularies: Vocabulary[];
}

export function BulkImportDialog({
  onClose,
  userId,
  topics,
  vocabularies
}: BulkImportDialogProps) {
  const [activeTab, setActiveTab] = useState<"paste" | "csv">("paste");
  const [rawText, setRawText] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState<{ current: number; total: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse raw input into items
  const parsedItems = useMemo(() => {
    if (activeTab === "paste") {
      return parseBulkText(rawText, selectedTopicId);
    } else {
      return parseCsvContent(csvContent, topics, selectedTopicId);
    }
  }, [activeTab, rawText, csvContent, selectedTopicId, topics]);

  // Analyze items for validation & duplicates
  const [enrichedOverrides, setEnrichedOverrides] = useState<Map<string, Partial<AnalyzedBulkRow>>>(
    new Map()
  );

  const { rows, summary } = useMemo(() => {
    const analysis = analyzeBulkItems(parsedItems, vocabularies);
    const updatedRows = analysis.rows.map((row) => {
      const override = enrichedOverrides.get(row.rawId);
      if (override) {
        return { ...row, ...override };
      }
      return row;
    });

    return {
      rows: updatedRows,
      summary: analysis.summary
    };
  }, [parsedItems, vocabularies, enrichedOverrides]);

  const validRows = useMemo(() => rows.filter((r) => r.status === "valid"), [rows]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content || "");
      setEnrichedOverrides(new Map());
    };
    reader.onerror = () => {
      toast.error("Không thể đọc file CSV này.");
    };
    reader.readAsText(file);
  };

  const handleAiBatchEnrich = async () => {
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
          newOverrides.set(row.rawId, {
            definition: detail.definition || row.definition || "",
            partOfSpeech: detail.partOfSpeech || row.partOfSpeech || "",
            phonetic: detail.phonetic || row.phonetic || ""
          });
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

  const handleImportSubmit = async () => {
    if (validRows.length === 0) {
      toast.error("Không có từ vựng hợp lệ nào để lưu.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = validRows.map((r) => ({
        word: r.word,
        definition: r.definition || "Chưa có định nghĩa",
        partOfSpeech: r.partOfSpeech || "",
        phonetic: r.phonetic || "",
        topicId: r.topicId || null
      }));

      const result = await batchCreateVocabularies(userId, payload);
      toast.success(`Đã thêm thành công ${result.successCount} từ vựng vào từ điển!`);
      onClose();
    } catch {
      toast.error("Lỗi khi lưu danh sách từ vựng vào hệ thống.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-3xl max-h-[90dvh] flex flex-col p-0 rounded-3xl overflow-hidden border-none shadow-2xl">
      <DialogHeader className="bg-[#10b981] p-5 sm:p-6 text-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Nhập từ vựng hàng loạt
            </DialogTitle>
            <p className="text-white/80 text-xs sm:text-sm font-medium mt-1">
              Dán danh sách hoặc tải file CSV để thêm nhanh nhiều từ vựng
            </p>
          </div>
          <Badge className="hidden sm:inline-flex bg-white/20 text-white hover:bg-white/30 border-none font-semibold px-3 py-1 text-xs">
            Bulk Import
          </Badge>
        </div>
      </DialogHeader>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 flex-1 overflow-y-auto flex flex-col bg-white">
        {/* Topic Selector Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
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
            className="w-full sm:w-64 h-10"
          />
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val as "paste" | "csv");
            setEnrichedOverrides(new Map());
          }}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl shrink-0 h-11">
            <TabsTrigger value="paste" className="rounded-lg font-semibold text-xs py-2">
              <FileText className="w-4 h-4 mr-1.5 text-[#10b981]" />
              Dán văn bản
            </TabsTrigger>
            <TabsTrigger value="csv" className="rounded-lg font-semibold text-xs py-2">
              <FileSpreadsheet className="w-4 h-4 mr-1.5 text-[#10b981]" />
              Tải file CSV
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Paste Text */}
          <TabsContent value="paste" className="mt-3 space-y-2 shrink-0">
            <div className="relative">
              <textarea
                placeholder={`Nhập hoặc dán các từ, mỗi từ một dòng:&#10;apple | quả táo | noun | /ˈæp.əl/&#10;banana | quả chuối&#10;orange&#10;computer | máy tính`}
                className="w-full h-28 sm:h-32 p-3 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#10b981] font-mono resize-none leading-relaxed"
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  setEnrichedOverrides(new Map());
                }}
              />
              {rawText && (
                <button
                  type="button"
                  onClick={() => {
                    setRawText("");
                    setEnrichedOverrides(new Map());
                  }}
                  className="absolute right-3 top-3 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Xóa nội dung"
                  aria-label="Xóa nội dung dán"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              Hỗ trợ: <code>word</code> hoặc <code>word | definition | partOfSpeech | phonetic</code>
            </p>
          </TabsContent>

          {/* Tab 2: CSV Upload */}
          <TabsContent value="csv" className="mt-3 space-y-2 shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-[#10b981] hover:bg-[#ECFDF5]/40 transition-all rounded-2xl p-5 sm:p-6 text-center cursor-pointer space-y-2"
            >
              <div className="w-10 h-10 bg-[#ECFDF5] text-[#10b981] rounded-full flex items-center justify-center mx-auto">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {fileName ? fileName : "Nhấp để chọn file CSV"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Format hỗ trợ: <code>word,definition,partOfSpeech,phonetic,topic</code>
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Live Analysis Summary & AI Action Bar */}
        {rows.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80 shrink-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-semibold">
              <span className="text-slate-600 font-bold">Tổng: {summary.total}</span>
              <span className="text-[#10b981] bg-[#ECFDF5] px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {summary.valid} hợp lệ
              </span>
              {summary.duplicateInFile > 0 && (
                <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Copy className="w-3 h-3" /> {summary.duplicateInFile} lặp trong file
                </span>
              )}
              {summary.duplicateInDb > 0 && (
                <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {summary.duplicateInDb} đã có
                </span>
              )}
              {summary.invalid > 0 && (
                <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <X className="w-3 h-3" /> {summary.invalid} lỗi
                </span>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAiBatchEnrich}
              disabled={isAiLoading || validRows.length === 0}
              className="border-emerald-200 text-[#10b981] bg-[#ECFDF5] hover:bg-[#ECFDF5]/80 rounded-lg text-xs font-semibold h-9 shrink-0 cursor-pointer"
            >
              {isAiLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  {aiProgress ? `Đang tra (${aiProgress.current}/${aiProgress.total})...` : "Đang tra AI..."}
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-[#10b981]" />
                  AI tra cứu tự động
                </>
              )}
            </Button>
          </div>
        )}

        {/* Live Preview List */}
        {rows.length > 0 && (
          <div className="flex-1 overflow-hidden border border-slate-200 rounded-xl bg-white flex flex-col min-h-[140px]">
            <div className="bg-slate-100/80 px-3 sm:px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 grid grid-cols-12 gap-2 shrink-0">
              <span className="col-span-4 sm:col-span-3">Từ vựng</span>
              <span className="col-span-4">Định nghĩa</span>
              <span className="hidden sm:inline sm:col-span-2">Phiên âm</span>
              <span className="col-span-4 sm:col-span-3">Trạng thái</span>
            </div>
            <ScrollArea className="flex-1 max-h-44 sm:max-h-48">
              <div className="divide-y divide-slate-100 text-xs">
                {rows.map((row) => (
                  <div
                    key={row.rawId}
                    className={`px-3 sm:px-4 py-2.5 grid grid-cols-12 gap-2 items-center transition-colors ${
                      row.status === "valid"
                        ? "hover:bg-slate-50"
                        : row.status === "invalid"
                          ? "bg-rose-50/40"
                          : "bg-amber-50/40"
                    }`}
                  >
                    <div className="col-span-4 sm:col-span-3 font-semibold text-slate-800 truncate">
                      {row.word}
                      {row.partOfSpeech && (
                        <span className="ml-1 text-[10px] text-slate-400 font-normal">
                          ({row.partOfSpeech})
                        </span>
                      )}
                    </div>
                    <div className="col-span-4 text-slate-600 truncate">
                      {row.definition || <span className="text-slate-300 italic">Chưa có nghĩa</span>}
                    </div>
                    <div className="hidden sm:inline sm:col-span-2 text-slate-400 font-mono text-[11px] truncate">
                      {row.phonetic ? `/${row.phonetic}/` : "—"}
                    </div>
                    <div className="col-span-4 sm:col-span-3">
                      {row.status === "valid" ? (
                        <span className="text-[#10b981] bg-[#ECFDF5] text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Hợp lệ
                        </span>
                      ) : row.status === "duplicate_in_file" ? (
                        <span className="text-amber-700 bg-amber-50 text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Copy className="w-3 h-3" /> Trùng file
                        </span>
                      ) : row.status === "duplicate_in_db" ? (
                        <span className="text-amber-700 bg-amber-50 text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Đã có
                        </span>
                      ) : (
                        <span className="text-rose-700 bg-rose-50 text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <X className="w-3 h-3" /> {row.errorMessage || "Lỗi"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <DialogFooter className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0 -mx-0 -mb-0">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isSubmitting}
          className="rounded-xl text-slate-500 font-medium h-11"
        >
          Hủy bỏ
        </Button>
        <Button
          type="button"
          onClick={handleImportSubmit}
          disabled={isSubmitting || validRows.length === 0}
          className="bg-[#10b981] hover:bg-[#10b981]/90 text-white rounded-xl px-6 font-semibold shadow-md shadow-[#10b981]/20 h-11 min-h-[44px] cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Đang lưu {validRows.length} từ...
            </>
          ) : (
            `Nhập ${validRows.length} từ hợp lệ`
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
