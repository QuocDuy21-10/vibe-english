import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
    <ConfirmDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      description={description}
      confirmText="Rời khỏi"
      cancelText="Tiếp tục học"
      variant="warning"
      onConfirm={onConfirmExit}
      onCancel={onClose}
    />
  );
}
