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

  return (
    <div className="min-h-screen bg-emerald-50 text-slate-800">
      <header className="sticky top-0 z-50 w-full border-b border-emerald-100 bg-white/80 backdrop-blur-md">
        <div className="container max-w-5xl mx-auto h-16 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-md shadow-emerald-100">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-emerald-900 hidden sm:inline-block">Vibe English</span>
          </div>

          <div className="flex items-center gap-4">
            <Badge
              variant="outline"
              className="bg-emerald-50 border-emerald-200 text-emerald-700 hidden sm:flex font-bold uppercase text-[10px]"
            >
              {totalVocab} từ vựng
            </Badge>
            <div className="flex items-center gap-2">
              <img
                src={user.photoURL || ""}
                alt={user.displayName || ""}
                className="w-8 h-8 rounded-full border border-emerald-200 shadow-sm"
                referrerPolicy="no-referrer"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto py-8 px-4">
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <nav className="bg-white p-1 rounded-xl w-fit border border-emerald-100 shadow-sm flex flex-wrap gap-1">
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
                      className="rounded-xl border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 transition-all shadow-sm"
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
                      className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-100 border-none transition-all"
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
    </div>
  );
}
