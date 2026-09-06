import * as React from "react";
import { AlertTriangle, HelpCircle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ConfirmVariant = "destructive" | "warning" | "default";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  icon?: React.ReactNode;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  showCloseButton?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText = "Hủy",
  variant = "destructive",
  icon,
  isLoading,
  onConfirm,
  onCancel,
  showCloseButton = true,
}: ConfirmDialogProps) {
  const [isInternalLoading, setIsInternalLoading] = React.useState(false);
  const loading = isLoading ?? isInternalLoading;

  const handleConfirm = async () => {
    try {
      const result = onConfirm();
      if (result && typeof (result as Promise<unknown>).then === "function") {
        setIsInternalLoading(true);
        await result;
      }
    } finally {
      setIsInternalLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (loading && !newOpen) return;
    if (!newOpen) {
      onCancel?.();
    }
    onOpenChange(newOpen);
  };

  const iconElement = React.useMemo(() => {
    if (icon) return icon;
    switch (variant) {
      case "destructive":
        return <Trash2 className="w-5 h-5" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5" />;
      case "default":
      default:
        return <HelpCircle className="w-5 h-5" />;
    }
  }, [icon, variant]);

  const badgeStyles = React.useMemo(() => {
    switch (variant) {
      case "destructive":
        return "bg-rose-50 border border-rose-100 text-rose-600";
      case "warning":
        return "bg-amber-50 border border-amber-100 text-amber-600";
      case "default":
      default:
        return "bg-emerald-50 border border-emerald-100 text-[#10b981]";
    }
  }, [variant]);

  const confirmBtnStyles = React.useMemo(() => {
    switch (variant) {
      case "destructive":
        return "bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-200 border-none";
      case "warning":
        return "bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-200 border-none";
      case "default":
      default:
        return "bg-[#10b981] hover:bg-[#059669] text-white shadow-sm shadow-emerald-200 border-none";
    }
  }, [variant]);

  const confirmTextResolved =
    confirmText ?? (variant === "destructive" ? "Xóa" : "Xác nhận");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={showCloseButton && !loading}
        className="sm:max-w-md rounded-3xl p-6 border-none shadow-2xl space-y-4"
      >
        <div className="flex items-start gap-3.5">
          <div
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center shrink-0 mt-0.5",
              badgeStyles
            )}
          >
            {iconElement}
          </div>
          <div className="space-y-1.5 flex-1 min-w-0 pr-6">
            <DialogHeader className="text-left p-0 space-y-0">
              <DialogTitle className="text-xl font-bold text-slate-900 leading-snug">
                {title}
              </DialogTitle>
            </DialogHeader>
            {description && (
              <DialogDescription className="text-sm text-slate-600 leading-relaxed font-normal">
                {description}
              </DialogDescription>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2 flex-col-reverse sm:flex-row gap-2 border-t-0 bg-transparent p-0">
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={() => handleOpenChange(false)}
            className="rounded-xl font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-none h-10 px-4 cursor-pointer"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={handleConfirm}
            className={cn(
              "rounded-xl font-semibold h-10 px-5 gap-2 cursor-pointer transition-colors",
              confirmBtnStyles
            )}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmTextResolved}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
