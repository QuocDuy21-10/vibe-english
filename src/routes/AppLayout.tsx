import { NavLink, Outlet } from "react-router-dom";
import { BookOpen, Brain, LayoutDashboard, Layers, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppData } from "./AppDataProvider";

const navItems = [
  { to: "/dashboard", label: "Bảng tin", icon: LayoutDashboard },
  { to: "/dictionary", label: "Từ điển", icon: BookOpen },
  { to: "/topics", label: "Chủ đề", icon: Layers },
  { to: "/study", label: "Flashcard", icon: Brain },
];

export function AppLayout() {
  const { user, dataLoading, vocabularies, logout } = useAppData();

  if (!user) {
    return null;
  }

  const totalVocab = vocabularies.length;
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
      isActive
        ? "bg-[#006c49] text-white shadow-sm"
        : "text-slate-600 hover:text-[#006c49] hover:bg-[#ECFDF5]"
    );

  return (
    <div className="min-h-screen bg-[#ECFDF5] text-slate-800 flex flex-col">
      {/* Custom TopAppBar */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white">
        <div className="container max-w-5xl mx-auto h-16 flex items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#006c49] rounded-lg flex items-center justify-center shadow-md shadow-[#006c49]/10">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-[#006c49]">Vibe English</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex bg-[#10b981]/15 px-3 py-1 rounded-full items-center gap-1">
              <span className="text-[#006c49] font-bold text-[10px] uppercase tracking-wider">{totalVocab} TỪ VỰNG</span>
            </div>

            <img
              src={user.photoURL || ""}
              alt={user.displayName || ""}
              className="w-8 h-8 rounded-full border border-slate-200 shadow-sm"
              referrerPolicy="no-referrer"
            />

            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-full p-2"
              title="Đăng xuất"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow w-full max-w-5xl mx-auto py-6 px-4 pb-28 md:pb-8 flex flex-col">
        <div className="space-y-6 flex-grow flex flex-col">
          {/* Desktop Navigation Link Cluster */}
          <nav className="bg-white p-1 rounded-xl w-fit border border-slate-200/60 shadow-sm hidden md:flex gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to} className={navLinkClass}>
                  <Icon className="w-4 h-4" /> {item.label}
                </NavLink>
              );
            })}
          </nav>

          {dataLoading ? (
            <div className="flex min-h-64 flex-1 items-center justify-center" role="status" aria-label="Đang tải dữ liệu">
              <Loader2 className="h-8 w-8 animate-spin text-[#006c49]" />
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar matching mockup */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200/60 py-2 px-4 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] flex md:hidden justify-around items-center pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 transition-all duration-200",
                  isActive
                    ? "bg-[#006c49] text-white rounded-full px-5 py-2 active:scale-95 shadow-sm"
                    : "text-slate-500 hover:text-[#006c49] px-3 py-1"
                )
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-bold">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
