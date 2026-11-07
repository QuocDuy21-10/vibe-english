import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Pencil, Target } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DAILY_GOAL_OPTIONS } from "@/constants/vocab";
import type { TodayProgress } from "@/lib/learningActivity";
import { cn } from "@/lib/utils";
import { setDailyGoal } from "@/services/userSettingsRepository";

type DailyGoalCardProps = {
  userId: string;
  progress: TodayProgress;
  isLoading: boolean;
};

export function DailyGoalCard({ userId, progress, isLoading }: DailyGoalCardProps) {
  const [open, setOpen] = useState(false);
  const [savingGoal, setSavingGoal] = useState<number | null>(null);
  const goalReached = progress.count >= progress.goal;

  const changeGoal = async (goal: number) => {
    if (goal === progress.goal) {
      setOpen(false);
      return;
    }
    setSavingGoal(goal);
    try {
      await setDailyGoal(userId, goal);
      toast.success(`Đã đặt mục tiêu ${goal} lượt mỗi ngày.`);
      setOpen(false);
    } catch {
      toast.error("Không thể lưu mục tiêu. Vui lòng thử lại.");
    } finally {
      setSavingGoal(null);
    }
  };

  return (
    <Card className="rounded-3xl border-none shadow-xl shadow-emerald-950/5 bg-white p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[#10b981] font-bold uppercase tracking-wider text-xs">
          <Target className="w-4 h-4" />
          Mục tiêu hôm nay
        </div>
        <Popover open={open} onOpenChange={(nextOpen) => savingGoal === null && setOpen(nextOpen)}>
          <PopoverTrigger
            aria-label="Đổi mục tiêu ngày"
            className="h-11 w-11 inline-flex items-center justify-center rounded-full text-slate-400 hover:text-[#10b981] hover:bg-[#ECFDF5] transition-colors cursor-pointer"
          >
            <Pencil className="w-4 h-4" />
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-64 p-3 rounded-2xl bg-white shadow-xl border border-slate-100 z-50"
          >
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Số lượt ôn mỗi ngày</p>
            <div className="grid grid-cols-3 gap-2">
              {DAILY_GOAL_OPTIONS.map((goal) => (
                <Button
                  key={goal}
                  type="button"
                  variant={goal === progress.goal ? "default" : "outline"}
                  disabled={savingGoal !== null}
                  aria-pressed={goal === progress.goal}
                  onClick={() => void changeGoal(goal)}
                  className="h-11 rounded-xl font-bold"
                >
                  {savingGoal === goal ? <Loader2 className="w-4 h-4 animate-spin" /> : goal}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-8" role="status" aria-label="Đang tải tiến độ hôm nay">
          <Loader2 className="h-6 w-6 animate-spin text-[#10b981]" />
        </div>
      ) : (
        <>
          <div>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {progress.count}
              <span className="text-slate-400">/{progress.goal}</span>
            </p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lượt ôn hôm nay</p>
          </div>
          <div
            className="h-3 bg-slate-100 rounded-full overflow-hidden"
            role="progressbar"
            aria-label="Tiến độ mục tiêu hôm nay"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
          >
            <div className="h-full bg-[#10b981] rounded-full transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="text-sm font-medium text-slate-600">
            {goalReached
              ? "Đã hoàn thành mục tiêu hôm nay 🎉"
              : `Còn ${progress.remaining} lượt nữa để đạt mục tiêu!`}
          </p>
          <div className="mt-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-xl font-black text-slate-800">
                {progress.accuracy === null ? "—" : `${progress.accuracy}%`}
              </p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tỷ lệ nhớ đúng</p>
            </div>
            <Link
              to="/study"
              className={cn(buttonVariants(), "h-11 px-5 rounded-full font-bold bg-[#10b981] hover:bg-[#10b981]/90")}
            >
              Học ngay
            </Link>
          </div>
        </>
      )}
    </Card>
  );
}
