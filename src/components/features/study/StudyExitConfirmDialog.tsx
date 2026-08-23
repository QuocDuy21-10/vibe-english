import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

type StudyExitConfirmDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExit: () => void;
  title?: string;
  description?: string;
};

export function StudyExitConfirmDialog({
  isOpen,
  onClose,
  onConfirmExit,
  title = "Rời khỏi phiên học?",
  description = "Tiến trình chưa hoàn thành của bài học này sẽ không được lưu. Bạn có chắc chắn muốn quay lại danh sách chủ đề không?"
}: StudyExitConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6 border-none shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-xl font-bold text-slate-900">{title}</DialogTitle>
          </DialogHeader>
        </div>

        <DialogDescription className="text-sm text-slate-600 leading-relaxed">
          {description}
        </DialogDescription>

        <DialogFooter className="pt-2 flex-col-reverse sm:flex-row gap-2 border-t-0 bg-transparent p-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="rounded-xl font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-none"
          >
            Tiếp tục học
          </Button>
          <Button
            type="button"
            onClick={onConfirmExit}
            className="rounded-xl font-semibold bg-rose-600 hover:bg-rose-700 text-white border-none shadow-sm shadow-rose-200"
          >
            Rời khỏi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
