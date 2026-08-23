import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createTopic, updateTopic } from "@/services/topicRepository";
import type { Topic } from "@/types/types";

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
    try {
      if (topic) {
        await updateTopic(topic.id, { name: data.name });
        toast.success("Đã cập nhật chủ đề!");
      } else {
        await createTopic(userId, { name: data.name });
        toast.success("Đã thêm chủ đề mới!");
      }
      onClose?.();
    } catch {
      toast.error("Lỗi khi xử lý chủ đề.");
    }
  };

  return (
    <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl p-6">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold text-slate-900">{topic ? "Chỉnh sửa chủ đề" : "Thêm chủ đề mới"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 ml-0.5">Tên chủ đề <span className="text-rose-500">*</span></label>
          <Input
            placeholder="Ví dụ: Công việc, Du lịch, Công nghệ..."
            aria-invalid={!!errors.name}
            {...register("name")}
            autoFocus
            className="rounded-xl h-11 border-slate-200 focus:ring-[#006c49] text-sm"
          />
          {errors.name && <p className="text-xs text-rose-500 font-medium">{errors.name.message}</p>}
        </div>

        <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2 border-t-0 bg-transparent p-0">
          {onClose && (
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl text-slate-500 h-11">
              Hủy
            </Button>
          )}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-[#006c49] hover:bg-[#006c49]/90 rounded-xl border-none text-white h-11 px-5 font-semibold text-sm cursor-pointer min-h-[44px]"
          >
            {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : topic ? "Cập nhật" : "Thêm chủ đề"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
