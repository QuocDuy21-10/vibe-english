import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "@/lib/firebase";
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
import { handleFirestoreError } from "@/lib/firestoreErrors";
import { DEFAULT_EASE_FACTOR, SRS_VERSION } from "@/lib/srs";
import { Topic, OperationType } from "@/types/types";

const vocabSchema = z.object({
  word: z.string().trim().min(1, "Vui lòng nhập từ tiếng Anh."),
  definition: z.string().trim().min(1, "Vui lòng nhập định nghĩa."),
  phonetic: z.string().trim().optional().or(z.literal("")),
  partOfSpeech: z.string().trim().optional().or(z.literal("")),
  topicId: z.string().trim().optional().or(z.literal(""))
});

type AddVocabFormValues = z.infer<typeof vocabSchema>;

export function AddVocabDialog({ onClose, userId, topics }: { 
  onClose: () => void, 
  userId: string, 
  topics: Topic[]
}) {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<AddVocabFormValues>({
    resolver: zodResolver(vocabSchema),
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

  const onSubmit = async (data: AddVocabFormValues) => {
    const normalized = {
      word: data.word.trim(),
      definition: data.definition.trim(),
      partOfSpeech: data.partOfSpeech?.trim() ?? "",
      phonetic: data.phonetic?.trim() ?? "",
      topicId: data.topicId?.trim() ?? ""
    };

    try {
      const currentUser = getAuth().currentUser;

      if (!currentUser) {
        toast.error("Bạn cần đăng nhập trước khi thêm từ vựng.");
        return;
      }

      // Firestore Rules require vocabulary.userId === request.auth.uid.
      // Never trust a userId passed from the UI as the source of truth.
      if (userId && userId !== currentUser.uid) {
        console.warn("AddVocabDialog userId does not match authenticated user", {
          propUserId: userId,
          authUserId: currentUser.uid,
        });
      }

      await addDoc(collection(db, "vocabularies"), {
        word: normalized.word,
        definition: normalized.definition,
        partOfSpeech: normalized.partOfSpeech,
        phonetic: normalized.phonetic,
        topicId: normalized.topicId || null,
        userId: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        level: 0,
        nextReview: serverTimestamp(),
        srsVersion: SRS_VERSION,
        intervalDays: 0,
        easeFactor: DEFAULT_EASE_FACTOR,
        repetitions: 0,
        lapses: 0,
        lastReviewedAt: null
      });
      toast.success("Đã thêm từ vựng!");
      onClose();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, "vocabularies");
      toast.error("Lỗi khi thêm từ vựng.");
    }
  };

  return (
    <DialogContent className="sm:max-w-lg rounded-[2rem] overflow-hidden p-0 border-none shadow-2xl">
      <div className="bg-emerald-500 p-8 text-white text-center shadow-inner">
        <DialogTitle className="text-3xl font-bold tracking-tight">Thêm từ mới</DialogTitle>
        <p className="text-white/80 text-sm font-medium mt-1">Mỗi từ mới là một bước tiến mới</p>
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
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl text-slate-400">Bỏ qua</Button>
          <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 h-12 px-10 rounded-xl shadow-lg shadow-emerald-100 border-none transition-all">
            {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : "Lưu vào từ điển"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}