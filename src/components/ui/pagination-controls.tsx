import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PaginationItem } from "@/lib/pagination";

type PaginationControlsProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  pageItems: PaginationItem[];
  pageSize: number;
  pageSizeOptions: number[];
  itemLabel: string;
  pageSizeLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  pageItems,
  pageSize,
  pageSizeOptions,
  itemLabel,
  pageSizeLabel,
  onPageChange,
  onPageSizeChange
}: PaginationControlsProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200/60 pt-6 pb-10">
      <div className="text-sm text-slate-500">
        Hiển thị <span className="font-semibold text-slate-700">{startIndex + 1}</span> -{" "}
        <span className="font-semibold text-slate-700">{endIndex}</span> trong số{" "}
        <span className="font-semibold text-slate-700">{totalItems}</span> {itemLabel}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1">
          <PaginationButton
            label="Trang đầu"
            disabled={currentPage === 1}
            onClick={() => onPageChange(1)}
          >
            <ChevronsLeft className="w-4 h-4 text-slate-600" />
          </PaginationButton>
          <PaginationButton
            label="Trang trước"
            disabled={currentPage === 1}
            onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </PaginationButton>

          {pageItems.map((pageItem, index) =>
            pageItem === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-2 text-slate-400 select-none">
                ...
              </span>
            ) : (
              <Button
                key={`page-${pageItem}`}
                variant={currentPage === pageItem ? "default" : "outline"}
                size="icon"
                className={`w-11 h-11 rounded-full border-slate-200 transition-all font-medium text-xs ${
                  currentPage === pageItem
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 shadow-sm"
                    : "hover:bg-slate-50 text-slate-700"
                }`}
                onClick={() => onPageChange(pageItem)}
                aria-label={`Trang ${pageItem}`}
                aria-current={currentPage === pageItem ? "page" : undefined}
              >
                {pageItem}
              </Button>
            )
          )}

          <PaginationButton
            label="Trang sau"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </PaginationButton>
          <PaginationButton
            label="Trang cuối"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(totalPages)}
          >
            <ChevronsRight className="w-4 h-4 text-slate-600" />
          </PaginationButton>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">{pageSizeLabel}</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger className="w-20 rounded-full border-slate-200 bg-white h-11 shadow-sm text-xs text-slate-700">
            <SelectValue placeholder={String(pageSize)} />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

type PaginationButtonProps = {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
};

function PaginationButton({ label, disabled, onClick, children }: PaginationButtonProps) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      className="w-11 h-11 rounded-full border-slate-200 hover:bg-slate-50 transition-colors"
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  );
}
