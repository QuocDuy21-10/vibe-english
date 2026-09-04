import { BookOpen } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/routes/AppDataProvider";

export function LoginPage() {
  const { login } = useAppData();

  return (
    <div className="min-h-dvh w-full flex flex-col items-center justify-center bg-[#ECFDF5] p-4 sm:p-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-8 sm:p-10 rounded-3xl shadow-xl shadow-emerald-900/5 border border-emerald-100/60 space-y-6"
      >
        <div className="w-20 h-20 bg-[#10b981] rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-[#10b981]/20">
          <BookOpen className="w-10 h-10 text-white" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">Vibe English</h1>
          <p className="text-slate-600 text-sm sm:text-base font-medium">
            Xây dựng vốn từ vựng của riêng bạn một cách tinh tế và hiệu quả.
          </p>
        </div>
        <Button
          onClick={login}
          className="w-full bg-[#10b981] hover:bg-[#10b981]/90 text-white rounded-xl h-12 text-base font-semibold shadow-md shadow-[#10b981]/20 border-none transition-all active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#ffffff"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#ffffff"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#ffffff"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#ffffff"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Đăng nhập với Google</span>
        </Button>
      </motion.div>
    </div>
  );
}
