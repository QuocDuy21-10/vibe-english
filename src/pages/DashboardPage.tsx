import { Award, Target, Trophy, Zap } from "lucide-react";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { LearningMomentumCard } from "@/components/features/LearningMomentumCard";
import { VocabularyNotificationCard } from "@/components/features/VocabularyNotificationCard";
import { LEVELS } from "@/constants/vocab";
import { useGamificationStats } from "@/hooks/useGamificationStats";
import { useVocabularyOverview } from "@/hooks/useVocabStats";
import { useAuth, useVocabularyData } from "@/routes/AppDataProvider";

// Geometry mirrors the previous Recharts pie (5px chart margin, 65%/85% radii, 4° padding,
// counter-clockwise from 3 o'clock) in a 100x100 viewBox, without loading the charting library.
const DONUT_BASE_RADIUS = 47;
const DONUT_RADIUS = DONUT_BASE_RADIUS * 0.75;
const DONUT_STROKE_WIDTH = DONUT_BASE_RADIUS * 0.2;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const DONUT_PADDING_ANGLE = 4;

type DonutSegment = { name: string; value: number; color: string };

function getDonutArcs(segments: DonutSegment[]) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) return [];

  const nonZeroCount = segments.filter((segment) => segment.value !== 0).length;
  const availableAngle = 360 - nonZeroCount * DONUT_PADDING_ANGLE;
  let previousEndAngle: number | null = null;

  return segments.flatMap((segment) => {
    const startAngle =
      previousEndAngle === null ? 0 : previousEndAngle + (segment.value !== 0 ? DONUT_PADDING_ANGLE : 0);
    const sweepAngle = (segment.value / total) * availableAngle;
    previousEndAngle = startAngle + sweepAngle;
    return segment.value === 0 ? [] : [{ ...segment, startAngle, sweepAngle }];
  });
}

function angleToArcLength(angle: number) {
  return (angle / 360) * DONUT_CIRCUMFERENCE;
}

function MasteryDonut({ segments }: { segments: DonutSegment[] }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <g transform="matrix(1 0 0 -1 0 100)">
        {getDonutArcs(segments).map((arc) => (
          <circle
            key={arc.name}
            cx="50"
            cy="50"
            r={DONUT_RADIUS}
            fill="none"
            stroke={arc.color}
            strokeWidth={DONUT_STROKE_WIDTH}
            strokeDasharray={`${angleToArcLength(arc.sweepAngle)} ${DONUT_CIRCUMFERENCE}`}
            strokeDashoffset={-angleToArcLength(arc.startAngle)}
          >
            <title>{`${arc.name}: ${arc.value}`}</title>
          </circle>
        ))}
      </g>
    </svg>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { vocabularies, topics } = useVocabularyData();
  const { stats, levelCounts } = useVocabularyOverview(vocabularies);
  const gamification = useGamificationStats(user?.uid, stats.learnedVocab);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 lg:gap-8">
      <Card className="md:col-span-2 rounded-3xl border-none shadow-xl shadow-emerald-950/5 bg-gradient-to-br from-white to-[#ECFDF5]/60 overflow-hidden p-5 sm:p-8 flex flex-col md:flex-row items-center gap-6 sm:gap-8">
        <div className="flex-1 space-y-3 sm:space-y-4 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-1.5 text-[#10b981] font-bold uppercase tracking-wider text-xs">
            <Award className="w-4 h-4 text-[#10b981]" />
            Trạng thái thành thạo
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Bạn đã chinh phục được{" "}
            <span className="text-[#10b981] underline decoration-[#10b981] decoration-4 sm:decoration-8 underline-offset-4">
              {stats.learnedVocab}
            </span>{" "}
            từ vựng!
          </h1>
          <p className="text-slate-600 text-sm sm:text-base font-medium leading-relaxed">
            Hãy tiếp tục duy trì đà học tập để mở khóa các cột mốc mới. Mỗi ngày một ít, tích tiểu thành đại.
          </p>
        </div>
        <div className="w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 shrink-0 relative flex items-center justify-center">
          <MasteryDonut
            segments={[
              { name: "Mastered", value: stats.learnedVocab, color: "#10b981" },
              { name: "Learning", value: Math.max(0, stats.totalVocab - stats.learnedVocab), color: "#e2e8f0" },
            ]}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl sm:text-3xl font-black text-slate-800">{stats.progress}%</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tiến độ</span>
          </div>
        </div>
      </Card>

      <Card className="rounded-3xl border-none shadow-xl shadow-amber-100/80 bg-amber-500 p-5 sm:p-8 text-white flex flex-col justify-between overflow-hidden relative min-h-[220px]">
        <div className="absolute top-0 right-0 p-4 opacity-20 rotate-12 pointer-events-none">
          <Target className="w-32 h-32" />
        </div>
        <div className="relative z-10 space-y-1 sm:space-y-2">
          <p className="text-amber-100/80 font-bold uppercase tracking-wider text-xs">Cột mốc tiếp theo</p>
          <h2 className="text-xl sm:text-2xl font-black">{stats.milestone.name}</h2>
        </div>
        <div className="relative z-10 space-y-3 sm:space-y-4 mt-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold font-mono">
              <span>{stats.learnedVocab} từ</span>
              <span>{stats.milestone.target} từ</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden border border-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (stats.learnedVocab / stats.milestone.target) * 100)}%` }}
                className="h-full bg-white shadow-lg"
              />
            </div>
          </div>
          <p className="text-xs font-medium text-amber-50 italic">
            "Kiến thức là chìa khóa mở cánh cửa tương lai."
          </p>
        </div>
      </Card>

      <div className="md:col-span-3">
        <LearningMomentumCard {...gamification} />
      </div>

      {/* Levels Matrix */}
      <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
        {LEVELS.map((lvl, index) => (
          <Card
            key={lvl}
            className="rounded-2xl sm:rounded-3xl border-slate-100 shadow-sm bg-white p-3.5 sm:p-4 text-center space-y-1 group hover:bg-[#ECFDF5]/60 hover:shadow-emerald-950/5 transition-all cursor-default text-inherit"
          >
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-[#10b981]">
              Level {lvl}
            </p>
            <div className="text-2xl sm:text-3xl font-black text-slate-800">{levelCounts[index]}</div>
            <p className="text-xs font-medium text-slate-400">
              {lvl === 0
                ? "Mới học"
                : lvl === 1
                  ? "Ghi nhớ"
                  : lvl === 2
                    ? "Vững vàng"
                    : lvl === 3
                      ? "Thành thạo"
                      : "Bậc thầy"}
            </p>
          </Card>
        ))}
      </div>

      {/* Overview Totals */}
      <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-inherit">
        <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100 flex items-center gap-4 sm:gap-6">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#ECFDF5] rounded-2xl flex items-center justify-center text-[#10b981] shrink-0">
            <Zap className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div className="space-y-0.5">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{vocabularies.length}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng vốn từ vựng</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100 flex items-center gap-4 sm:gap-6">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
            <Trophy className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div className="space-y-0.5">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{topics.length}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chủ đề đã tạo</p>
          </div>
        </div>
      </div>

      {user && (
        <div className="md:col-span-3">
          <VocabularyNotificationCard userId={user.uid} vocabularyCount={vocabularies.length} />
        </div>
      )}
    </div>
  );
}
