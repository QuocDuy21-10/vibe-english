import { useEffect, useMemo } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { BookOpen, Brain, LayoutDashboard, Layers, LineChart, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { AudioSettingsDialog } from "@/components/features/AudioSettingsDialog";
import { Button } from "@/components/ui/button";
import { createRecentMessageDeduper, createVocabularyNotificationDisplay } from "@/lib/pushNotification";
import { cn } from "@/lib/utils";
import { subscribeToForegroundVocabularyMessages } from "@/services/notificationService";
import { useAuth, useVocabularyData } from "./AppDataProvider";

const navItems = [
  { to: "/dashboard", label: "Bảng tin", icon: LayoutDashboard },
  { to: "/dictionary", label: "Từ điển", icon: BookOpen },
  { to: "/topics", label: "Chủ đề", icon: Layers },
  { to: "/study", label: "Flashcard", icon: Brain },
  { to: "/progress", label: "Tiến độ", icon: LineChart },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const { dataLoading, vocabularies } = useVocabularyData();
  const navigate = useNavigate();
  const shouldDisplayMessage = useMemo(() => createRecentMessageDeduper(), []);

  useEffect(() => {
    if (!user) return;

    let active = true;
    let unsubscribe: (() => void) | undefined;
    subscribeToForegroundVocabularyMessages((message) => {
      if (!shouldDisplayMessage(message.messageId)) return;
      // FCM hands pushes to the visible page instead of the service worker, so show the OS notification here.
      const { title, options } = createVocabularyNotificationDisplay(message);
      navigator.serviceWorker.ready
        .then((registration) => registration.showNotification(title, options))
        .catch((error) => {
          console.error("Unable to show foreground notification", error);
          toast.info(message.title, {
            description: message.body,
            action: {
              label: "Mở từ điển",
              onClick: () => navigate(message.url)
            }
          });
        });
    })
      .then((listenerCleanup) => {
        if (active) unsubscribe = listenerCleanup;
        else listenerCleanup();
      })
      .catch((error) => {
        console.error("Unable to subscribe to foreground notifications", error);
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [navigate, shouldDisplayMessage, user]);

  if (!user) {
    return null;
  }

  const totalVocab = vocabularies.length;
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
      isActive
        ? "bg-[#10b981] text-white shadow-sm"
        : "text-slate-600 hover:text-[#10b981] hover:bg-[#ECFDF5]"
    );

  return (
    <div className="min-h-dvh bg-[#ECFDF5] text-slate-800 flex flex-col">
      {/* Custom TopAppBar */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white">
        <div className="container max-w-5xl mx-auto h-16 flex items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" width="32" height="32" className="h-8 w-8 shrink-0 rounded-lg shadow-md shadow-[#10b981]/10" />
            <span className="text-xl font-bold tracking-tight text-[#10b981]">Vocabloom</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:flex bg-[#10b981]/15 px-3 py-1 rounded-full items-center gap-1">
              <span className="text-[#10b981] font-bold text-xs uppercase tracking-wider">{totalVocab} TỪ VỰNG</span>
            </div>

            <AudioSettingsDialog />

            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || "User avatar"}
                className="w-9 h-9 rounded-full border border-slate-200 shadow-sm object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span
                role="img"
                aria-label={user.displayName || user.email || "User avatar"}
                className="flex w-9 h-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-[#ECFDF5] text-sm font-bold uppercase text-[#10b981] shadow-sm"
              >
                {(user.displayName || user.email || "?").charAt(0)}
              </span>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-full w-11 h-11 min-w-[44px] p-0"
              title="Đăng xuất"
              aria-label="Đăng xuất"
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
          <nav aria-label="Desktop Navigation" className="bg-white p-1.5 rounded-xl w-fit border border-slate-200/60 shadow-sm hidden md:flex gap-1">
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
              <Loader2 className="h-8 w-8 animate-spin text-[#10b981]" />
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/80 py-1.5 px-3 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] flex md:hidden justify-around items-center pb-safe"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center min-h-[48px] min-w-[60px] px-2 py-1 rounded-2xl transition-all duration-200 touch-manipulation",
                  isActive
                    ? "bg-[#10b981] text-white shadow-sm font-bold scale-[1.02]"
                    : "text-slate-600 hover:text-[#10b981] hover:bg-slate-50 font-medium"
                )
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[11px] leading-tight tracking-tight">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
