import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { BookOpen, Brain, LayoutDashboard, Layers, LogOut, Plus } from "lucide-react";
import { AddVocabDialog } from "@/components/features/AddVocabDialog";
import { TopicDialog } from "@/components/features/TopicDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAppData } from "./AppDataProvider";

const navItems = [
  { to: "/dashboard", label: "Bảng tin", icon: LayoutDashboard },
  { to: "/dictionary", label: "Từ điển", icon: BookOpen },
  { to: "/topics", label: "Chủ đề", icon: Layers },
  { to: "/study", label: "Flashcard", icon: Brain },
];

export function AppLayout() {
  const { user, topics, vocabularies, logout } = useAppData();
  const [isAddingVocab, setIsAddingVocab] = useState(false);
  const [isAddingTopic, setIsAddingTopic] = useState(false);

  if (!user) {
    return null;
  }

  const totalVocab = vocabularies.length;
  
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
      isActive
        ? "bg-emerald-500 text-white shadow-sm"
        : "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
    );

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex flex-col items-center justify-center gap-0.5 text-xs font-semibold px-4 py-1.5 transition-all duration-200",
      isActive
        ? "bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-100/50 scale-105"
        : "text-slate-500 hover:text-emerald-700 hover:bg-emerald-50/50 rounded-2xl"
    );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-28 md:pb-8">
      {/* Top Header */}
      <header className="sticky top-0 z-50 w-full border-b border-emerald-100 bg-white/80 backdrop-blur-md">
        <div className="container max-w-5xl mx-auto h-16 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shadow-md shadow-emerald-100">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-emerald-950">Vibe English</span>
          </div>

          <div className="flex items-center gap-4">
            <Badge
              variant="outline"
              className="bg-emerald-50 border-emerald-200 text-emerald-700 hidden sm:flex font-bold uppercase text-[10px]"
            >
              {totalVocab} từ vựng
            </Badge>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-emerald-500 overflow-hidden flex items-center justify-center shadow-sm">
                <img
                  src={user.photoURL || ""}
                  alt={user.displayName || ""}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl"
                title="Đăng xuất"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container max-w-5xl mx-auto py-6 px-4 md:py-8">
        <div className="space-y-6 md:space-y-8">
          
          {/* Sub-header navigation (Desktop only) */}
          <div className="hidden md:flex items-center justify-between gap-4">
            <nav className="bg-white p-1 rounded-xl w-fit border border-emerald-100 shadow-sm flex gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.to} to={item.to} className={navLinkClass}>
                    <Icon className="w-4 h-4" /> {item.label}
                  </NavLink>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <Dialog open={isAddingTopic} onOpenChange={setIsAddingTopic}>
                <DialogTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 transition-all shadow-sm h-10 px-4"
                    />
                  }
                >
                  <Layers className="w-4 h-4 mr-2" /> Thêm chủ đề
                </DialogTrigger>
                <TopicDialog onClose={() => setIsAddingTopic(false)} userId={user.uid} />
              </Dialog>

              <Dialog open={isAddingVocab} onOpenChange={setIsAddingVocab}>
                <DialogTrigger
                  render={
                    <Button
                      size="sm"
                      className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-100 border-none transition-all h-10 px-4"
                    />
                  }
                >
                  <Plus className="w-4 h-4 mr-2" /> Thêm từ mới
                </DialogTrigger>
                <AddVocabDialog onClose={() => setIsAddingVocab(false)} userId={user.uid} topics={topics} />
              </Dialog>
            </div>
          </div>

          {/* Hidden wrappers to support opening dialogs from Outlet views on mobile */}
          <Dialog open={isAddingVocab} onOpenChange={setIsAddingVocab}>
            <AddVocabDialog onClose={() => setIsAddingVocab(false)} userId={user.uid} topics={topics} />
          </Dialog>

          <Dialog open={isAddingTopic} onOpenChange={setIsAddingTopic}>
            <TopicDialog onClose={() => setIsAddingTopic(false)} userId={user.uid} />
          </Dialog>

          {/* Active view */}
          <Outlet context={{ setIsAddingVocab, setIsAddingTopic }} />
        </div>
      </main>

      {/* Floating Action Button (FAB) (Mobile only) */}
      <button
        onClick={() => setIsAddingVocab(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-xl flex items-center justify-center transition-transform duration-200 active:scale-90 hover:scale-105 z-40 md:hidden border border-white/20"
        aria-label="Thêm từ mới"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Bottom Navigation Bar (Mobile only) */}
      <nav className="fixed bottom-0 left-0 w-full z-45 flex justify-around items-center px-4 py-2 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-2xl md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className={mobileNavLinkClass}>
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

