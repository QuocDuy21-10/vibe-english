import { Flame, Loader2, Lock, Medal, Sparkles } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  BADGE_GROUPS,
  STREAK_MIN_REVIEWS,
  type BadgeGroup,
  type GamificationStats
} from "@/lib/gamification";
import { cn } from "@/lib/utils";

const GROUP_LABELS: Record<BadgeGroup, string> = {
  streak: "Chuỗi ngày",
  xp: "Điểm XP",
  mastered: "Từ thành thạo",
  reviews: "Lượt ôn"
};

const numberFormat = new Intl.NumberFormat("vi-VN");

type LearningMomentumCardProps = {
  loading: boolean;
  error: boolean;
  stats: GamificationStats;
};

export function LearningMomentumCard({ loading, error, stats }: LearningMomentumCardProps) {
  if (loading) {
    return (
      <Card className="rounded-3xl border-slate-100 shadow-sm bg-white p-6 sm:p-8 flex flex-row items-center justify-center gap-2 text-sm font-medium text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-[#10b981]" aria-hidden="true" />
        Đang tải streak và XP...
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-3xl border-slate-100 shadow-sm bg-white p-6 sm:p-8 text-center text-sm font-medium text-slate-500">
        <p role="alert">Không thể tải streak và XP lúc này. Hãy tải lại trang để thử lại.</p>
      </Card>
    );
  }

  const reviewsToday = Math.min(stats.todayReviewCount, STREAK_MIN_REVIEWS);
  const remaining = STREAK_MIN_REVIEWS - reviewsToday;
  const todayProgress = (reviewsToday / STREAK_MIN_REVIEWS) * 100;

  return (
    <Card className="rounded-3xl border-slate-100 shadow-sm bg-white p-5 sm:p-8 gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-orange-50 p-4 flex items-center gap-3">
          <Flame className="w-8 h-8 text-orange-500 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-2xl font-black text-slate-900">{stats.currentStreak} ngày</p>
            <p className="text-xs font-medium text-slate-500">
              Streak hiện tại · Dài nhất {stats.longestStreak} ngày
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-[#ECFDF5] p-4 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-[#10b981] shrink-0" aria-hidden="true" />
          <div>
            <p className="text-2xl font-black text-slate-900">{numberFormat.format(stats.totalXp)} XP</p>
            <p className="text-xs font-medium text-slate-500">+{numberFormat.format(stats.todayXp)} XP hôm nay</p>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4 space-y-2">
          <div className="flex justify-between text-xs font-bold text-slate-500">
            <span>Ôn hôm nay</span>
            <span className="font-mono">
              {reviewsToday}/{STREAK_MIN_REVIEWS}
            </span>
          </div>
          <div
            className="h-2.5 rounded-full bg-slate-200 overflow-hidden"
            role="progressbar"
            aria-label="Tiến độ giữ streak hôm nay"
            aria-valuemin={0}
            aria-valuemax={STREAK_MIN_REVIEWS}
            aria-valuenow={reviewsToday}
          >
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${todayProgress}%` }} />
          </div>
          <p className="text-xs font-medium text-slate-500">
            {remaining > 0 ? `Còn ${remaining} lượt để giữ chuỗi` : "Đã giữ chuỗi hôm nay"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Huy hiệu</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {BADGE_GROUPS.map((group) => {
            const next = stats.nextByGroup[group];
            return (
              <div key={group} className="rounded-2xl border border-slate-100 p-3 sm:p-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{GROUP_LABELS[group]}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {stats.badges
                    .filter((badge) => badge.group === group)
                    .map((badge) => (
                      <li
                        key={badge.id}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          badge.earned ? "bg-[#ECFDF5] text-[#10b981]" : "bg-slate-100 text-slate-400"
                        )}
                      >
                        {badge.earned ? (
                          <Medal className="w-3 h-3" aria-hidden="true" />
                        ) : (
                          <Lock className="w-3 h-3" aria-hidden="true" />
                        )}
                        {badge.label}
                        <span className="sr-only">{badge.earned ? " (đã đạt)" : " (chưa đạt)"}</span>
                      </li>
                    ))}
                </ul>
                {next ? (
                  <p className="text-xs text-slate-500">
                    Tiếp theo: {numberFormat.format(next.current)}/{numberFormat.format(next.badge.threshold)}
                  </p>
                ) : (
                  <p className="text-xs font-semibold text-[#10b981]">Đã đạt tất cả</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
