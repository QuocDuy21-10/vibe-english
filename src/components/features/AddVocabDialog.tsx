import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { 
  DialogContent, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { TopicFilterSelect } from "@/components/features/TopicFilterSelect";
import { findDuplicateVocabulary } from "@/lib/vocabulary";
import { vocabularyInputSchema, type VocabularyInputFormValues } from "@/lib/vocabularyValidation";
import { createVocabulary } from "@/services/vocabularyRepository";
import type { Topic, Vocabulary } from "@/types/types";

export function AddVocabDialog({
  onClose,
  userId,
  topics,
  vocabularies = []
}: {
  onClose: () => void;
  userId: string;
  topics: Topic[];
  vocabularies?: Vocabulary[];
}) {
  const [isAiLoading, setIsAiLoading] = useState(false);
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
      word: "",
      definition: "",
      phonetic: "",
      partOfSpeech: "",
      topicId: ""
    }
  });

  const wordValue = watch("word") ?? "";

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

  const onSubmit = async (data: VocabularyInputFormValues) => {
    // Duplicate detection check
    const duplicate = findDuplicateVocabulary(data.word, vocabularies);
    if (duplicate) {
      const topicName = topics.find((t) => t.id === duplicate.topicId)?.name || "Chưa phân loại";
      const errorMsg = `Từ "${duplicate.word}" đã có trong từ điển của bạn (thuộc: ${topicName}).`;
      setError("word", { message: errorMsg });
      toast.error(errorMsg);
      return;
    }

    try {
      await createVocabulary(userId, {
        word: data.word,
        definition: data.definition,
        partOfSpeech: data.partOfSpeech,
        phonetic: data.phonetic,
        topicId: data.topicId
      });
      toast.success("Đã thêm từ vựng!");
      onClose();
    } catch {
      toast.error("Lỗi khi thêm từ vựng.");
    }
  };

  return (
    <DialogContent className="sm:max-w-lg rounded-3xl overflow-hidden p-0 border-none shadow-2xl max-h-[90dvh] flex flex-col">
      <div className="bg-[#006c49] p-5 sm:p-6 text-white text-center shrink-0">
        <DialogTitle className="text-2xl sm:text-3xl font-bold tracking-tight">Thêm từ mới</DialogTitle>
        <p className="text-white/80 text-xs sm:text-sm font-medium mt-1">Mỗi từ mới là một bước tiến mới</p>
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
                className="rounded-xl h-11 sm:h-12 text-base border-slate-200 focus:ring-[#006c49]"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl border-emerald-200 text-[#006c49] bg-[#ECFDF5] hover:bg-[#ECFDF5]/80 font-semibold text-xs sm:text-sm shrink-0 min-h-[44px] cursor-pointer"
              onClick={handleAiLookup}
              disabled={isAiLoading || !wordValue.trim()}
            >
              {isAiLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4 sm:mr-1.5 text-[#006c49]" />}
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
                  <Select value={field.value ?? ""} onValueChange={(value) => field.onChange(value ?? "")}>
                    <SelectTrigger className="w-full rounded-xl h-11 border-slate-200 text-sm">
                      <SelectValue placeholder="Chọn loại từ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="noun">Noun (Danh từ)</SelectItem>
                      <SelectItem value="verb">Verb (Động từ)</SelectItem>
                      <SelectItem value="adjective">Adjective (Tính từ)</SelectItem>
                      <SelectItem value="adverb">Adverb (Trạng từ)</SelectItem>
                      <SelectItem value="prep">Prep (Giới từ)</SelectItem>
                      <SelectItem value="conj">Conj (Liên từ)</SelectItem>
                      <SelectItem value="other">Other (Khác)</SelectItem>
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
              className="rounded-xl h-11 border-slate-200 font-semibold text-[#006c49] text-sm sm:text-base"
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
        </div>

        <DialogFooter className="pt-3 flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2.5 shrink-0 border-t border-slate-100 bg-transparent p-0 -mx-0 -mb-0">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl text-slate-500 h-11">
            Bỏ qua
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-[#006c49] hover:bg-[#006c49]/90 text-white h-11 sm:h-12 px-6 rounded-xl shadow-md shadow-[#006c49]/20 font-semibold text-sm border-none transition-all cursor-pointer min-h-[44px]"
          >
            {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : "Lưu vào từ điển"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}