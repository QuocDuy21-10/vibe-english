import { useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  Award,
  BookOpen,
  ChevronRight,
  Flame,
  Layers,
  Plus,
  Trophy,
  Zap,
  Utensils,
  Plane,
  Briefcase,
  Atom,
  Laptop,
  Heart,
  Music,
  Film,
  Gamepad,
  School,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { useAppData } from "@/routes/AppDataProvider";
import { Vocabulary, Topic } from "@/types/types";

// Helper to get local YYYY-MM-DD date string
const getLocalDateString = (dateObj: any) => {
  if (!dateObj) return null;
  let d: Date;
  if (typeof dateObj.toDate === "function") {
    d = dateObj.toDate();
  } else if (dateObj instanceof Date) {
    d = dateObj;
  } else if (typeof dateObj === "object" && dateObj.seconds) {
    d = new Date(dateObj.seconds * 1000);
  } else {
    d = new Date(dateObj);
  }
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD local date format
};

// Calculate streak based on createdAt/updatedAt days
const calculateStreak = (vocab: Vocabulary[]) => {
  if (vocab.length === 0) return 0;
  
  const dates = new Set<string>();
  vocab.forEach((v) => {
    const cDate = getLocalDateString(v.createdAt);
    if (cDate) dates.add(cDate);
    const uDate = getLocalDateString(v.updatedAt);
    if (uDate) dates.add(uDate);
  });
  
  if (dates.size === 0) return 0;
  
  const todayStr = getLocalDateString(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);
  
  const sortedDates = Array.from(dates).sort((a, b) => b.localeCompare(a));
  
  // If the most recent study date is neither today nor yesterday, streak is broken
  if (sortedDates[0] !== todayStr && sortedDates[0] !== yesterdayStr) {
    return 0;
  }
  
  let streak = 0;
  const checkDate = new Date(sortedDates[0]);
  
  while (true) {
    const checkStr = getLocalDateString(checkDate);
    if (checkStr && dates.has(checkStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
};

// Map topic names to Lucide icons
const getTopicIcon = (topicName: string) => {
  const name = topicName.toLowerCase();
  if (name.includes("ăn") || name.includes("ẩm thực") || name.includes("food") || name.includes("restaurant") || name.includes("eat")) return Utensils;
  if (name.includes("đi") || name.includes("du lịch") || name.includes("travel") || name.includes("flight") || name.includes("trip")) return Plane;
  if (name.includes("kinh doanh") || name.includes("business") || name.includes("work") || name.includes("office") || name.includes("job")) return Briefcase;
  if (name.includes("khoa học") || name.includes("science") || name.includes("research") || name.includes("physic") || name.includes("chemistry")) return Atom;
  if (name.includes("công nghệ") || name.includes("tech") || name.includes("computer") || name.includes("code") || name.includes("laptop")) return Laptop;
  if (name.includes("yêu") || name.includes("sức khỏe") || name.includes("love") || name.includes("heart") || name.includes("health") || name.includes("medical")) return Heart;
  if (name.includes("nhạc") || name.includes("music") || name.includes("song") || name.includes("audio")) return Music;
  if (name.includes("phim") || name.includes("movie") || name.includes("film") || name.includes("video")) return Film;
  if (name.includes("game") || name.includes("trò chơi") || name.includes("play")) return Gamepad;
  return School; // default icon
};

export function DashboardPage() {
  const { user, vocabularies, topics } = useAppData();
  const { setIsAddingVocab, setIsAddingTopic } = useOutletContext<{
    setIsAddingVocab: (val: boolean) => void;
    setIsAddingTopic: (val: boolean) => void;
  }>();

  // Greeting based on local time
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Chào buổi sáng";
    if (hour < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  }, []);

  const firstName = useMemo(() => {
    if (!user?.displayName) return "bạn";
    return user.displayName.trim().split(" ").slice(-1)[0];
  }, [user]);

  // Streak calculation
  const streak = useMemo(() => calculateStreak(vocabularies), [vocabularies]);

  // Studied/added today count
  const studiedToday = useMemo(() => {
    const todayStr = getLocalDateString(new Date());
    return vocabularies.filter((v) => {
      const createdStr = getLocalDateString(v.createdAt);
      const updatedStr = getLocalDateString(v.updatedAt);
      return createdStr === todayStr || updatedStr === todayStr;
    }).length;
  }, [vocabularies]);

  const dailyGoal = 5;
  const dailyProgressPercent = Math.min(100, Math.round((studiedToday / dailyGoal) * 100));

  // Determine active/recently-studied topic
  const activeTopic = useMemo(() => {
    if (topics.length === 0) return null;
    
    // Track last active timestamp for each topic
    const topicLastUpdated = new Map<string, number>();
    vocabularies.forEach((v) => {
      if (!v.topicId) return;
      const time = v.updatedAt?.seconds || v.createdAt?.seconds || 0;
      const currentMax = topicLastUpdated.get(v.topicId) || 0;
      if (time > currentMax) {
        topicLastUpdated.set(v.topicId, time);
      }
    });

    const sorted = [...topics].sort((a, b) => {
      const timeA = topicLastUpdated.get(a.id) || 0;
      const timeB = topicLastUpdated.get(b.id) || 0;
      return timeB - timeA;
    });

    return sorted[0];
  }, [topics, vocabularies]);

  // Active topic stats
  const activeTopicStats = useMemo(() => {
    if (!activeTopic) return { total: 0, mastered: 0, percent: 0 };
    const topicVocab = vocabularies.filter((v) => v.topicId === activeTopic.id);
    const total = topicVocab.length;
    const mastered = topicVocab.filter((v) => (v.level || 0) === 4).length;
    const percent = total > 0 ? Math.round((mastered / total) * 100) : 0;
    return { total, mastered, percent };
  }, [activeTopic, vocabularies]);

  // General vocabulary metrics
  const totalMastered = useMemo(() => {
    return vocabularies.filter((v) => (v.level || 0) === 4).length;
  }, [vocabularies]);

  const currentRank = useMemo(() => {
    if (totalMastered >= 20) return "Bậc thầy từ vựng 👑";
    if (totalMastered >= 10) return "Nhà chinh phục chuyên nghiệp 🌟";
    if (totalMastered >= 1) return "Người học chăm chỉ 🌱";
    return "Người mới bắt đầu 🥚";
  }, [totalMastered]);

  // Achievement criteria
  const achievements = useMemo(() => {
    return [
      {
        id: "streak",
        name: "Chăm Chỉ",
        description: "Chuỗi học tập ≥ 3 ngày",
        unlocked: streak >= 3,
        color: "text-amber-500 bg-amber-50 border-amber-200",
        icon: Flame,
      },
      {
        id: "mastery",
        name: "Thông Thái",
        description: "Thành thạo ≥ 10 từ",
        unlocked: totalMastered >= 10,
        color: "text-emerald-600 bg-emerald-50 border-emerald-200",
        icon: Trophy,
      },
      {
        id: "topics",
        name: "Đa Dạng",
        description: "Tạo ít nhất 3 chủ đề",
        unlocked: topics.length >= 3,
        color: "text-sky-600 bg-sky-50 border-sky-200",
        icon: Layers,
      },
      {
        id: "beginner",
        name: "Khởi Đầu",
        description: "Học ít nhất 5 từ vựng",
        unlocked: vocabularies.length >= 5,
        color: "text-indigo-600 bg-indigo-50 border-indigo-200",
        icon: Zap,
      },
    ];
  }, [streak, totalMastered, topics.length, vocabularies.length]);

  // Suggested topics (take top 4 sorted by vocabulary count desc)
  const suggestedTopics = useMemo(() => {
    const counts = new Map<string, number>();
    vocabularies.forEach((v) => {
      if (!v.topicId) return;
      counts.set(v.topicId, (counts.get(v.topicId) ?? 0) + 1);
    });

    return [...topics]
      .map((t) => ({ ...t, count: counts.get(t.id) ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [topics, vocabularies]);

  return (
    <div className="space-y-6 md:space-y-8 max-w-4xl mx-auto">
      {/* Welcome / Header Section */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            {greeting}, {firstName}! <span className="animate-bounce">👋</span>
          </h2>
          <p className="text-slate-500 font-medium text-sm md:text-base">
            Sẵn sàng để chinh phục thêm từ vựng mới chưa?
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50/80 border border-emerald-100 px-4 py-2.5 rounded-full w-fit shadow-xs transition-all hover:bg-emerald-50">
          <Flame className="w-5 h-5 text-amber-500 fill-amber-500 animate-pulse" />
          <span className="text-sm font-bold text-emerald-800">
            Chuỗi {streak} ngày
          </span>
        </div>
      </section>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Hero Card: Continue Learning */}
        <Card className="md:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm relative overflow-hidden group flex flex-col justify-between min-h-[220px]">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none">
            <BookOpen className="w-36 h-36 text-emerald-900" />
          </div>
          
          {activeTopic ? (
            <>
              <div className="space-y-3 relative z-10">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block">
                  Tiếp tục học
                </span>
                <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight leading-tight line-clamp-1">
                  {activeTopic.name}
                </h3>
                <div className="flex items-center gap-4 pt-2">
                  <div className="flex-1 bg-emerald-50 h-2.5 rounded-full overflow-hidden border border-emerald-100">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${activeTopicStats.percent}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="bg-emerald-500 h-full rounded-full"
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-400 shrink-0">
                    {activeTopicStats.mastered} / {activeTopicStats.total} THẺ
                  </span>
                </div>
              </div>
              <div className="pt-4 relative z-10">
                <Link
                  to={`/study?topicId=${activeTopic.id}`}
                  className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 duration-100 text-white font-bold text-sm px-6 py-3 rounded-full flex items-center gap-2 w-fit shadow-md shadow-emerald-100/50 transition-all"
                >
                  Học ngay
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2 relative z-10">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block">
                  Tiếp tục học
                </span>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">
                  Chưa có chủ đề nào
                </h3>
                <p className="text-slate-500 text-sm font-medium">
                  Tạo chủ đề đầu tiên và thêm từ mới của riêng bạn để bắt đầu ôn tập!
                </p>
              </div>
              <div className="pt-4 relative z-10">
                <button
                  onClick={() => setIsAddingTopic(true)}
                  className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 duration-100 text-white font-bold text-sm px-6 py-3 rounded-full flex items-center gap-2 w-fit shadow-md shadow-emerald-100/50 transition-all border-none"
                >
                  <Plus className="w-4 h-4" />
                  Tạo chủ đề ngay
                </button>
              </div>
            </>
          )}
        </Card>

        {/* Stats Card: Total Vocabulary */}
        <Card className="bg-emerald-50/50 border border-emerald-100 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none">
            <Award className="w-32 h-32 text-emerald-800" />
          </div>

          <div className="space-y-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Tổng vốn từ
              </h4>
              <p className="text-4xl font-black text-slate-800 mt-1">
                {vocabularies.length}{" "}
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block sm:inline">
                  từ vựng
                </span>
              </p>
            </div>
          </div>
          
          <div className="pt-4">
            <Link
              to="/dictionary"
              className="text-emerald-600 hover:text-emerald-700 font-bold text-xs flex items-center gap-1 transition-colors"
            >
              Xem từ điển
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </Card>

        {/* Daily Goal Card */}
        <Card className="bg-white border border-slate-100 rounded-3xl p-6 flex items-center gap-6 shadow-sm">
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-full h-full -rotate-90">
              <circle
                className="text-slate-100"
                cx="40"
                cy="40"
                fill="transparent"
                r="34"
                stroke="currentColor"
                strokeWidth="8"
              />
              <circle
                className="text-emerald-500 rounded-full"
                cx="40"
                cy="40"
                fill="transparent"
                r="34"
                stroke="currentColor"
                strokeDasharray="213.6"
                strokeDashoffset={213.6 - (213.6 * dailyProgressPercent) / 100}
                strokeWidth="8"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-black text-slate-800">
                {dailyProgressPercent}%
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-black text-slate-800">
              Mục tiêu hàng ngày
            </h4>
            <p className="text-xs font-semibold text-slate-400">
              {studiedToday >= dailyGoal
                ? "Hoàn thành mục tiêu ngày! 🎉"
                : `Còn ${dailyGoal - studiedToday} từ nữa thôi!`}
            </p>
          </div>
        </Card>

        {/* Achievements Card */}
        <Card className="bg-white border border-slate-100 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 col-span-1 md:col-span-2 shadow-sm relative overflow-hidden">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              Thành tích học tập
            </div>
            <h4 className="text-lg font-black text-slate-800 tracking-tight">
              {currentRank}
            </h4>
            <p className="text-xs font-semibold text-slate-400">
              Chinh phục thêm từ level 4 để thăng hạng!
            </p>
          </div>

          <div className="flex gap-3 items-center w-full sm:w-auto justify-start sm:justify-end">
            {achievements.map((a) => {
              const IconComponent = a.icon;
              return (
                <div
                  key={a.id}
                  title={`${a.name}: ${a.description}`}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all duration-200 ${
                    a.unlocked
                      ? `${a.color} shadow-sm cursor-pointer hover:scale-110`
                      : "text-slate-300 bg-slate-50 border-slate-100 opacity-40 cursor-not-allowed"
                  }`}
                >
                  <IconComponent className="w-5 h-5" />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Suggested Topics Section */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-black text-slate-800 tracking-tight">
            Chủ đề học tập
          </h3>
          <Link
            to="/topics"
            className="text-emerald-600 hover:text-emerald-700 font-bold text-xs flex items-center gap-0.5 transition-colors"
          >
            Tất cả chủ đề
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {suggestedTopics.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {suggestedTopics.map((topic) => {
              const Icon = getTopicIcon(topic.name);
              return (
                <Link
                  key={topic.id}
                  to={`/study?topicId=${topic.id}`}
                  className="bg-white border border-slate-100 hover:border-emerald-200 rounded-2xl p-4 hover:-translate-y-1 transition-all duration-200 cursor-pointer group shadow-xs hover:shadow-md hover:shadow-emerald-50/50"
                >
                  <div className="w-full aspect-square bg-slate-50 rounded-xl mb-3 flex items-center justify-center text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                    <Icon className="w-8 h-8 group-hover:scale-110 transition-transform duration-200" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800 line-clamp-1">
                    {topic.name}
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {topic.count} từ vựng
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-slate-100 rounded-3xl p-8 text-center space-y-4 shadow-xs">
            <Layers className="w-12 h-12 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-800">
                Chưa có chủ đề học tập nào
              </h4>
              <p className="text-xs font-semibold text-slate-400">
                Hãy tạo chủ đề học tập đầu tiên để bắt đầu hành trình của bạn.
              </p>
            </div>
            <button
              onClick={() => setIsAddingTopic(true)}
              className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 duration-100 text-white font-bold text-xs px-5 py-2.5 rounded-full flex items-center gap-1.5 mx-auto border-none shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Tạo chủ đề
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
