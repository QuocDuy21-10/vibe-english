import { Award, Target, Trophy, Zap } from "lucide-react";
import { motion } from "motion/react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { LEVELS } from "@/constants/vocab";
import { useVocabularyOverview } from "@/hooks/useVocabStats";
import { useAppData } from "@/routes/AppDataProvider";

export function DashboardPage() {
  const { vocabularies, topics } = useAppData();
  const { stats, levelCounts } = useVocabularyOverview(vocabularies);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 lg:gap-8">
      <Card className="md:col-span-2 rounded-3xl border-none shadow-xl shadow-emerald-100/70 bg-gradient-to-br from-white to-emerald-50/40 overflow-hidden p-5 sm:p-8 flex flex-col md:flex-row items-center gap-6 sm:gap-8">
        <div className="flex-1 space-y-3 sm:space-y-4 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-1.5 text-emerald-700 font-bold uppercase tracking-wider text-xs">
            <Award className="w-4 h-4 text-emerald-600" />
            Trạng thái thành thạo
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Bạn đã chinh phục được{" "}
            <span className="text-emerald-600 underline decoration-emerald-300 decoration-4 sm:decoration-8 underline-offset-4">
              {stats.learnedVocab}
            </span>{" "}
            từ vựng!
          </h1>
          <p className="text-slate-600 text-sm sm:text-base font-medium leading-relaxed">
            Hãy tiếp tục duy trì đà học tập để mở khóa các cột mốc mới. Mỗi ngày một ít, tích tiểu thành đại.
          </p>
        </div>
        <div className="w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 shrink-0 relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: "Mastered", value: stats.learnedVocab, color: "#10b981" },
                  { name: "Learning", value: Math.max(0, stats.totalVocab - stats.learnedVocab), color: "#e2e8f0" },
                ]}
                innerRadius="65%"
                outerRadius="85%"
                paddingAngle={4}
                dataKey="value"
              >
                <Cell key="cell-0" fill="#10b981" />
                <Cell key="cell-1" fill="#e2e8f0" />
              </Pie>
              <RechartsTooltip />
            </PieChart>
          </ResponsiveContainer>
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

      {/* Levels Matrix */}
      <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
        {LEVELS.map((lvl, index) => (
          <Card
            key={lvl}
            className="rounded-2xl sm:rounded-3xl border-slate-100 shadow-sm bg-white p-3.5 sm:p-4 text-center space-y-1 group hover:bg-emerald-50/50 hover:shadow-emerald-100/50 transition-all cursor-default text-inherit"
          >
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-emerald-600">
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
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
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
    </div>
  );
}
