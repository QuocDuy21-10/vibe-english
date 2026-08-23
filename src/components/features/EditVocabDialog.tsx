import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
      topicId: vocabulary.topicId || ""
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
    // Duplicate detection check (excluding current vocabulary)
    const duplicate = findDuplicateVocabulary(data.word, vocabularies, vocabulary.id);
    if (duplicate) {
      const topicName = topics.find((t) => t.id === duplicate.topicId)?.name || "Chưa phân loại";
      const errorMsg = `Từ "${duplicate.word}" đã tồn tại ở một mục khác trong từ điển của bạn (thuộc: ${topicName}).`;
      setError("word", { message: errorMsg });
      toast.error(errorMsg);
      return;
    }

    try {
      await updateVocabulary(vocabulary.id, {
        word: data.word,
        definition: data.definition,
        partOfSpeech: data.partOfSpeech,
        phonetic: data.phonetic,
        topicId: data.topicId
      });
      toast.success("Đã cập nhật từ vựng!");
      onClose();
    } catch {
      toast.error("Lỗi khi cập nhật.");
    }
  };

  return (
    <DialogContent className="sm:max-w-lg rounded-[2rem] overflow-hidden p-0 border-none shadow-2xl">
      <div className="bg-emerald-500 p-8 text-white text-center shadow-inner">
        <DialogTitle className="text-3xl font-bold tracking-tight">Chỉnh sửa từ vựng</DialogTitle>
        <p className="text-white/80 text-sm font-medium mt-1">Cập nhật và hoàn thiện thông tin từ vựng</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6 bg-white">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Input
              placeholder="Nhập từ tiếng Anh..."
              aria-invalid={!!errors.word}
              {...register("word")}
              className="rounded-xl h-12 text-lg border-slate-200 focus:ring-emerald-500"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-xl border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
            onClick={handleAiLookup}
            disabled={isAiLoading || !wordValue.trim()}
          >
            {isAiLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4 mr-2" />}
            AI Tra
          </Button>
        </div>
        {errors.word && <p className="text-xs text-rose-500 font-medium -mt-3">{errors.word.message}</p>}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Phiên âm</label>
              <Input
                placeholder="/Phonetic/"
                {...register("phonetic")}
                className="rounded-xl h-11 border-slate-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Loại từ</label>
              <Controller
                control={control}
                name="partOfSpeech"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={(value) => field.onChange(value ?? "")}>
                    <SelectTrigger className="rounded-xl h-11 border-slate-100">
                      <SelectValue placeholder="Chọn loại từ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="noun">Noun</SelectItem>
                      <SelectItem value="verb">Verb</SelectItem>
                      <SelectItem value="adjective">Adjective</SelectItem>
                      <SelectItem value="adverb">Adverb</SelectItem>
                      <SelectItem value="prep">Prep</SelectItem>
                      <SelectItem value="conj">Conj</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Định nghĩa</label>
            <Input
              placeholder="Nghĩa tiếng Việt..."
              aria-invalid={!!errors.definition}
              {...register("definition")}
              className="rounded-xl h-11 border-slate-100 font-bold text-emerald-700"
            />
            {errors.definition && <p className="text-xs text-rose-500 font-medium">{errors.definition.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Chủ đề</label>
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
                />
              )}
            />
          </div>
        </div>

        <DialogFooter className="pt-4 flex justify-between! items-center sm:flex-row! gap-4">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl text-slate-400">
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-emerald-500 hover:bg-emerald-600 h-12 px-10 rounded-xl shadow-lg shadow-emerald-100 border-none transition-all"
          >
            {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
