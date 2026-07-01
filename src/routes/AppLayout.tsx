import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { BookOpen, Brain, LayoutDashboard, Layers, LogOut, Plus, Menu, Search } from "lucide-react";
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
        ? "bg-[#006c49] text-white shadow-sm"
        : "text-slate-600 hover:text-[#006c49] hover:bg-[#ECFDF5]"
    );

  return (
    <div className="min-h-screen bg-[#ECFDF5] text-slate-800 flex flex-col">
      {/* Custom TopAppBar matching mockup */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white sticky top-0">
        <div className="container max-w-5xl mx-auto h-16 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {/* Menu icon visible on mobile only */}
            <Button
              variant="ghost"
              size="icon"
              className="text-[#006c49] hover:bg-[#ECFDF5] p-2 rounded-full active:scale-95 duration-150 md:hidden"
            >
              <Menu className="w-5 h-5" />
            </Button>
            
            {/* Logo on desktop, or simple text on mobile */}
            <div className="hidden md:flex items-center gap-2">
              <div className="w-8 h-8 bg-[#006c49] rounded-lg flex items-center justify-center shadow-md shadow-[#006c49]/10">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-[#006c49]">Vibe English</span>
            </div>
            
            <h1 className="text-xl font-bold text-[#006c49] md:hidden">Vibe English</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex bg-[#10b981]/15 px-3 py-1 rounded-full items-center gap-1">
              <span className="text-[#006c49] font-bold text-[10px] uppercase tracking-wider">{totalVocab} TỪ VỰNG</span>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="text-[#006c49] hover:bg-[#ECFDF5] p-2 rounded-full active:scale-95 duration-150"
            >
              <Search className="w-5 h-5" />
            </Button>
            
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
          <div className="flex items-center justify-between gap-4">
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

            {/* Quick Action dialog triggers */}
            <div className="flex items-center gap-2 ml-auto">
              <Dialog open={isAddingTopic} onOpenChange={setIsAddingTopic}>
                <DialogTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-slate-200 text-[#006c49] bg-white hover:bg-[#ECFDF5] transition-all shadow-sm h-9"
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
                      className="bg-[#10b981] hover:bg-[#10b981]/90 text-white rounded-xl shadow-md shadow-[#10b981]/10 border-none transition-all h-9"
                    />
                  }
                >
                  <Plus className="w-4 h-4 mr-2" /> Thêm từ mới
                </DialogTrigger>
                <AddVocabDialog onClose={() => setIsAddingVocab(false)} userId={user.uid} topics={topics} />
              </Dialog>
            </div>
          </div>

          <Outlet />
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
