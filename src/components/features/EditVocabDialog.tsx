import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PART_OF_SPEECH_LABELS, PART_OF_SPEECH_OPTIONS } from "@/constants/vocab";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { TopicFilterSelect } from "@/components/features/TopicFilterSelect";
import { SynonymField } from "@/components/features/SynonymField";
import { checkDuplicateVocabulary, hasSelfSynonym } from "@/lib/vocabulary";
import { vocabularyInputSchema, type VocabularyInputFormValues } from "@/lib/vocabularyValidation";
import { updateVocabulary } from "@/services/vocabularyRepository";
import type { Topic, Vocabulary } from "@/types/types";

type EditVocabDialogProps = {
  vocabulary: Vocabulary;
  topics: Topic[];
  vocabularies?: Vocabulary[];
  onClose: () => void;
};

export function EditVocabDialog({
  vocabulary,
  topics,
  vocabularies = [],
  onClose
}: EditVocabDialogProps) {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [crossTopicConfirm, setCrossTopicConfirm] = useState<{
    data: VocabularyInputFormValues;
    oldTopicName: string;
    newTopicName: string;
    word: string;
    partOfSpeech?: string;
  } | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<VocabularyInputFormValues>({
    resolver: zodResolver(vocabularyInputSchema),
    defaultValues: {
      word: vocabulary.word,
      definition: vocabulary.definition,
      partOfSpeech: vocabulary.partOfSpeech || "",
      phonetic: vocabulary.phonetic || "",
      topicId: vocabulary.topicId || "",
      synonymIds: vocabulary.synonymIds ?? [],
      customSynonyms: vocabulary.customSynonyms ?? []
    }
  });

  const wordValue = watch("word") ?? "";
  const synonymIds = watch("synonymIds") ?? [];
  const customSynonyms = watch("customSynonyms") ?? [];

  const handleAiLookup = async () => {
    const trimmedWord = wordValue.trim();
    if (!trimmedWord) return;
    setIsAiLoading(true);
    try {
      const { getWordDetails } = await import("@/services/geminiService");
      const details = await getWordDetails(trimmedWord);
      if (details) {
        setValue("definition", details.definition || "", { shouldDirty: true, shouldValidate: true });
        setValue("partOfSpeech", details.partOfSpeech || "", { shouldDirty: true, shouldValidate: true });
        setValue("phonetic", details.phonetic || "", { shouldDirty: true, shouldValidate: true });
      }
      toast.success("AI đã hoàn tất tra cứu! ✨");
    } catch (e) {
      toast.error("Không thể lấy thông tin từ AI.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const saveVocab = async (data: VocabularyInputFormValues) => {
    try {
      await updateVocabulary(vocabulary.id, {
        word: data.word,
        definition: data.definition,
        partOfSpeech: data.partOfSpeech,
        phonetic: data.phonetic,
        topicId: data.topicId,
        synonymIds: data.synonymIds,
        customSynonyms: data.customSynonyms
      });
      toast.success("Đã cập nhật từ vựng!");
      onClose();
    } catch {
      toast.error("Lỗi khi cập nhật.");
    }
  };

  const onSubmit = async (data: VocabularyInputFormValues) => {
    if (
      hasSelfSynonym(
        data.word,
        {
          synonymIds: data.synonymIds ?? [],
          customSynonyms: data.customSynonyms ?? []
        },
        vocabularies
      )
    ) {
      const errorMsg = "Từ đang chỉnh sửa không thể đồng thời nằm trong danh sách từ đồng nghĩa.";
      setError("word", { message: errorMsg });
      toast.error(errorMsg);
      return;
    }

    // Duplicate detection check (excluding current vocabulary)
    const checkResult = checkDuplicateVocabulary(data.word, vocabularies, {
      partOfSpeech: data.partOfSpeech,
      topicId: data.topicId,
      excludeVocabId: vocabulary.id
    });

    if (checkResult.isDuplicate && checkResult.existingVocab) {
      const duplicate = checkResult.existingVocab;
      const oldTopicName = topics.find((t) => t.id === duplicate.topicId)?.name || "Chưa phân loại";
      const newTopicName = topics.find((t) => t.id === data.topicId)?.name || "Chưa phân loại";

      if (checkResult.duplicateType === "exact") {
        const posDisplay = data.partOfSpeech
          ? ` (${data.partOfSpeech})`
          : duplicate.partOfSpeech
          ? ` (loại từ: ${duplicate.partOfSpeech})`
          : "";
        const hint = !data.partOfSpeech && duplicate.partOfSpeech
          ? " Nếu đây là từ loại khác, vui lòng chọn loại từ."
          : "";
        const errorMsg = `Từ "${duplicate.word}"${posDisplay} đã tồn tại ở một mục khác trong chủ đề "${oldTopicName}".${hint}`;
        setError("word", { message: errorMsg });
        toast.error(errorMsg);
        return;
      }

      if (checkResult.duplicateType === "cross_topic") {
        setCrossTopicConfirm({
          data,
          oldTopicName,
          newTopicName,
          word: duplicate.word,
          partOfSpeech: data.partOfSpeech || duplicate.partOfSpeech || ""
        });
        return;
      }
    }

    await saveVocab(data);
  };

  return (
    <DialogContent className="sm:max-w-lg rounded-3xl overflow-hidden p-0 border-none shadow-2xl max-h-[90dvh] flex flex-col">
      <div className="bg-[#10b981] p-5 sm:p-6 text-white text-center shrink-0">
        <DialogTitle className="text-2xl sm:text-3xl font-bold tracking-tight">Chỉnh sửa từ vựng</DialogTitle>
        <p className="text-white/80 text-xs sm:text-sm font-medium mt-1">Cập nhật và hoàn thiện thông tin từ vựng</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-5 sm:p-6 space-y-4 sm:space-y-5 bg-white overflow-y-auto flex-1">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 ml-0.5">Từ vựng tiếng Anh <span className="text-rose-500">*</span></label>
          <div className="flex gap-2 sm:gap-3">
            <div className="flex-1 relative">
              <Input
                placeholder="Ví dụ: resilient, comprehensive..."
                aria-invalid={!!errors.word}
                {...register("word")}
                className="rounded-xl h-11 sm:h-12 text-base border-slate-200 focus:ring-[#10b981]"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl border-emerald-200 text-[#10b981] bg-[#ECFDF5] hover:bg-[#ECFDF5]/80 font-semibold text-xs sm:text-sm shrink-0 min-h-[44px] cursor-pointer"
              onClick={handleAiLookup}
              disabled={isAiLoading || !wordValue.trim()}
            >
              {isAiLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4 sm:mr-1.5 text-[#10b981]" />}
              <span>AI Tra</span>
            </Button>
          </div>
          {errors.word && <p className="text-xs text-rose-500 font-medium">{errors.word.message}</p>}
        </div>

        <div className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 ml-0.5">Phiên âm</label>
              <Input
                placeholder="/rɪˈzɪl.jənt/"
                {...register("phonetic")}
                className="rounded-xl h-11 border-slate-200 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 ml-0.5">Loại từ</label>
              <Controller
                control={control}
                name="partOfSpeech"
                render={({ field }) => (
                  <Select items={PART_OF_SPEECH_LABELS} value={field.value ?? ""} onValueChange={(value) => field.onChange(value ?? "")}>
                    <SelectTrigger className="w-full rounded-xl h-11 border-slate-200 text-sm">
                      <SelectValue placeholder="Chọn loại từ" />
                    </SelectTrigger>
                    <SelectContent>
                      {PART_OF_SPEECH_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>{PART_OF_SPEECH_LABELS[value]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 ml-0.5">Định nghĩa tiếng Việt <span className="text-rose-500">*</span></label>
            <Input
              placeholder="Nghĩa tiếng Việt..."
              aria-invalid={!!errors.definition}
              {...register("definition")}
              className="rounded-xl h-11 border-slate-200 font-semibold text-[#10b981] text-sm sm:text-base"
            />
            {errors.definition && <p className="text-xs text-rose-500 font-medium">{errors.definition.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 ml-0.5">Chủ đề</label>
            <Controller
              control={control}
              name="topicId"
              render={({ field }) => (
                <TopicFilterSelect
                  value={field.value ?? ""}
                  onValueChange={(val) => field.onChange(val)}
                  topics={topics}
                  showAllOption={false}
                  unassignedValue=""
                  placeholder="Chọn chủ đề"
                  variant="form"
                  className="w-full h-11"
                />
              )}
            />
          </div>

          <SynonymField
            value={{ synonymIds, customSynonyms }}
            onChange={(selection) => {
              setValue("synonymIds", selection.synonymIds, { shouldDirty: true });
              setValue("customSynonyms", selection.customSynonyms, {
                shouldDirty: true,
                shouldValidate: true
              });
            }}
            vocabularies={vocabularies}
            currentVocabularyId={vocabulary.id}
            currentWord={wordValue}
          />
        </div>

        {crossTopicConfirm && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm text-amber-950">
                <p className="font-bold">Từ vựng đã có trong chủ đề khác</p>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Từ <span className="font-semibold text-slate-900">"{crossTopicConfirm.word}"</span>
                  {crossTopicConfirm.partOfSpeech ? ` (${crossTopicConfirm.partOfSpeech})` : ""} đã tồn tại trong chủ đề{" "}
                  <span className="font-semibold text-slate-900">"{crossTopicConfirm.oldTopicName}"</span>.
                  Bạn có muốn tiếp tục cập nhật và lưu từ này không?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCrossTopicConfirm(null)}
                className="h-8 text-xs font-semibold text-slate-600 hover:bg-amber-100"
              >
                Hủy
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isSubmitting}
                onClick={async () => {
                  const pending = crossTopicConfirm.data;
                  setCrossTopicConfirm(null);
                  await saveVocab(pending);
                }}
                className="h-8 text-xs font-semibold bg-[#10b981] hover:bg-[#059669] text-white border-none shadow-xs"
              >
                Vẫn lưu thay đổi
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="sticky -bottom-5 sm:-bottom-6 z-10 flex flex-row justify-between items-center gap-2.5 shrink-0 border-t border-slate-100 bg-white px-0 pt-3 pb-5 sm:pb-6 -mx-0 -mb-5 sm:-mb-6">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl text-slate-500 h-11">
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 sm:flex-none bg-[#10b981] hover:bg-[#10b981]/90 text-white h-11 sm:h-12 px-6 rounded-xl shadow-md shadow-[#10b981]/20 font-semibold text-sm border-none transition-all cursor-pointer min-h-[44px]"
          >
            {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
