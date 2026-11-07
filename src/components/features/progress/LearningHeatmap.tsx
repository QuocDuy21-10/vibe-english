import { CalendarDays, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatShortDate, type HeatmapCell } from "@/lib/learningActivity";
import { cn } from "@/lib/utils";

const INTENSITY_CLASSES = [
  "bg-slate-100",
  "bg-emerald-100",
  "bg-emerald-300",
  "bg-emerald-500",
  "bg-emerald-700"
] as const;
const WEEKDAY_ROW_LABELS = ["T2", "", "T4", "", "T6", "", "CN"];

type LearningHeatmapProps = {
  weeks: HeatmapCell[][];
  isLoading: boolean;
};

export function LearningHeatmap({ weeks, isLoading }: LearningHeatmapProps) {
  const cells = weeks.flat();
  const totalCount = cells.reduce((sum, cell) => sum + cell.count, 0);
  const activeDays = cells.filter((cell) => cell.count > 0).length;

  return (
    <Card className="h-full rounded-3xl border-none shadow-xl shadow-emerald-950/5 bg-white p-5 sm:p-6 flex flex-col gap-4">
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-[#10b981] font-bold uppercase tracking-wider text-xs">
          <CalendarDays className="w-4 h-4" />
          Hoạt động 10 tuần gần đây
        </div>
        {!isLoading && (
          <p className="text-sm text-slate-500 font-medium">
            {activeDays} ngày học · {totalCount} lượt ôn
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-8" role="status" aria-label="Đang tải hoạt động">
          <Loader2 className="h-6 w-6 animate-spin text-[#10b981]" />
        </div>
      ) : (
        <div className="flex w-full max-w-sm gap-1.5 sm:gap-2">
          <div className="grid grid-rows-7 gap-1 sm:gap-1.5 text-[10px] font-bold text-slate-400" aria-hidden="true">
            {WEEKDAY_ROW_LABELS.map((label, index) => (
              <span key={index} className="flex items-center leading-none">
                {label}
              </span>
            ))}
          </div>
          <div
            role="img"
            aria-label={`${activeDays} ngày có hoạt động, tổng ${totalCount} lượt ôn trong 10 tuần gần đây`}
            className="grid flex-1 grid-cols-10 gap-1 sm:gap-1.5"
          >
            {weeks.map((week) => (
              <div key={week[0].dayKey} className="grid grid-rows-7 gap-1 sm:gap-1.5">
                {week.map((cell) => (
                  <div
                    key={cell.dayKey}
                    title={cell.isFuture ? undefined : `${formatShortDate(cell.date)}: ${cell.count} lượt`}
                    className={cn(
                      "aspect-square rounded-[4px] sm:rounded-md",
                      cell.isFuture ? "bg-transparent" : INTENSITY_CLASSES[cell.intensity],
                      cell.isToday && "ring-2 ring-[#10b981] ring-offset-1"
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto flex items-center justify-end gap-1.5 text-[10px] font-bold text-slate-400" aria-hidden="true">
        Ít
        {INTENSITY_CLASSES.map((className) => (
          <span key={className} className={cn("h-3 w-3 rounded-[3px]", className)} />
        ))}
        Nhiều
      </div>
    </Card>
  );
}
