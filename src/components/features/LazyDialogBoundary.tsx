import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type LazyDialogBoundaryProps = {
  children: ReactNode;
  resetKey?: string | number | boolean;
  reload?: () => void;
  dialog?: boolean;
};

type LazyDialogBoundaryState = {
  hasError: boolean;
};

export class LazyDialogBoundary extends Component<LazyDialogBoundaryProps, LazyDialogBoundaryState> {
  state: LazyDialogBoundaryState = { hasError: false };

  static getDerivedStateFromError(): LazyDialogBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: LazyDialogBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // The dialog boundary intentionally keeps chunk failures local to the dialog.
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.dialog) {
      return (
        <DialogContent className="sm:max-w-lg rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle>Không thể tải hộp thoại</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 p-6 text-center" role="alert">
            <p className="text-sm text-slate-600">Không thể tải hộp thoại. Vui lòng thử lại.</p>
            <Button type="button" variant="outline" onClick={this.props.reload ?? (() => window.location.reload())}>
              Tải lại
            </Button>
          </div>
        </DialogContent>
      );
    }

    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center" role="alert">
        <p className="text-sm text-slate-600">Không thể tải hộp thoại. Vui lòng thử lại.</p>
        <Button type="button" variant="outline" onClick={this.props.reload ?? (() => window.location.reload())}>
          Tải lại
        </Button>
      </div>
    );
  }
}
