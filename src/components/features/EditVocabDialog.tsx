import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/firebase";
import { handleFirestoreError } from "@/lib/firestoreErrors";
import { OperationType, Topic, Vocabulary } from "@/types/types";

const vocabSchema = z.object({
  word: z.string().trim().min(1, "Vui lòng nhập từ vựng."),
  definition: z.string().trim().min(1, "Vui lòng nhập định nghĩa."),
  phonetic: z.string().trim().optional().or(z.literal("")),
  partOfSpeech: z.string().trim().optional().or(z.literal("")),
  topicId: z.string().trim().optional().or(z.literal(""))
});

type EditVocabFormValues = z.infer<typeof vocabSchema>;

type EditVocabDialogProps = {
  vocabulary: Vocabulary;
  topics: Topic[];
  onClose: () => void;
};

export function EditVocabDialog({ vocabulary, topics, onClose }: EditVocabDialogProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<EditVocabFormValues>({
    resolver: zodResolver(vocabSchema),
    defaultValues: {
      word: vocabulary.word,
      definition: vocabulary.definition,
      partOfSpeech: vocabulary.partOfSpeech || "",
      phonetic: vocabulary.phonetic || "",
      topicId: vocabulary.topicId || ""
    }
  });

  const onSubmit = async (data: EditVocabFormValues) => {
    const normalized = {
      word: data.word.trim(),
      definition: data.definition.trim(),
      partOfSpeech: data.partOfSpeech?.trim() ?? "",
      phonetic: data.phonetic?.trim() ?? "",
      topicId: data.topicId?.trim() ?? ""
    };

    try {
      await updateDoc(doc(db, "vocabularies", vocabulary.id), {
        word: normalized.word,
        definition: normalized.definition,
        partOfSpeech: normalized.partOfSpeech,
        phonetic: normalized.phonetic,
        topicId: normalized.topicId || null,
        updatedAt: serverTimestamp()
      });
      toast.success("Đã cập nhật!");
      onClose();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `vocabularies/${vocabulary.id}`);
      toast.error("Lỗi khi cập nhật.");
    }
  };

  return (
    <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold text-slate-800">Chỉnh sửa từ vựng</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Từ vựng</label>
          <Input
            placeholder="Từ tiếng Anh"
            aria-invalid={!!errors.word}
            {...register("word")}
            className="rounded-xl h-11 border-slate-100 font-bold"
          />
          {errors.word && <p className="text-xs text-rose-500 font-medium">{errors.word.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Phiên âm</label>
            <Input placeholder="Phonetic" {...register("phonetic")} className="rounded-xl h-11 border-slate-100" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Loại từ</label>
            <Input placeholder="Loại từ" {...register("partOfSpeech")} className="rounded-xl h-11 border-slate-100" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Định nghĩa</label>
          <Input
            placeholder="Nghĩa"
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
              <Select value={field.value ?? ""} onValueChange={(value) => field.onChange(value ?? "")}>
                <SelectTrigger className="rounded-xl h-11 border-slate-100 bg-white">
                  <SelectValue placeholder="Chọn chủ đề" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <DialogFooter className="pt-4">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl text-slate-400">
            Hủy
          </Button>
          <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 rounded-xl border-none shadow-lg shadow-emerald-50 transition-all">
            {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
