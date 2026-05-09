import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import { handleFirestoreError } from "@/lib/firestoreErrors";
import { OperationType, Topic } from "@/types/types";

const topicSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên chủ đề.")
});

type TopicFormValues = z.infer<typeof topicSchema>;

type TopicDialogProps = {
  onClose?: () => void;
  userId: string;
  topic?: Topic;
};

export function TopicDialog({ onClose, userId, topic }: TopicDialogProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<TopicFormValues>({
    resolver: zodResolver(topicSchema),
    defaultValues: {
      name: topic?.name || ""
    }
  });

  const onSubmit = async (data: TopicFormValues) => {
    const name = data.name.trim();

    try {
      if (topic) {
        await updateDoc(doc(db, "topics", topic.id), {
          name
        });
        toast.success("Đã cập nhật chủ đề!");
      } else {
        await addDoc(collection(db, "topics"), {
          name,
          userId,
          createdAt: serverTimestamp()
        });
        toast.success("Đã thêm chủ đề mới!");
      }
      onClose?.();
    } catch (e) {
      if (e instanceof Error && e.message.includes('{"error"')) {
        // Already handled
      } else {
        handleFirestoreError(e, topic ? OperationType.UPDATE : OperationType.CREATE, "topics");
      }
      toast.error("Lỗi khi xử lý chủ đề.");
    }
  };

  return (
    <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold">{topic ? "Chỉnh sửa chủ đề" : "Thêm chủ đề mới"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <Input
          placeholder="Tên chủ đề (ví dụ: Công việc, Du lịch...)"
          aria-invalid={!!errors.name}
          {...register("name")}
          autoFocus
          className="rounded-xl h-11 border-slate-200 focus:ring-emerald-500"
        />
        {errors.name && <p className="text-xs text-rose-500 font-medium">{errors.name.message}</p>}
        <DialogFooter>
          {onClose && (
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">
              Hủy
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 rounded-xl border-none">
            {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : topic ? "Cập nhật" : "Thêm chủ đề"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
