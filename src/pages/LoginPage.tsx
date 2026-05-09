import { BookOpen } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/routes/AppDataProvider";

export function LoginPage() {
  const { login } = useAppData();

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-emerald-50 p-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md space-y-6"
      >
        <div className="w-20 h-20 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-200">
          <BookOpen className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Vibe English</h1>
        <p className="text-emerald-800 font-medium italic">
          Xây dựng vốn từ vựng của riêng bạn một cách tinh tế và hiệu quả.
        </p>
        <Button
          onClick={login}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-12 text-lg shadow-lg shadow-emerald-100 border-none"
        >
          Bắt đầu với Google
        </Button>
      </motion.div>
    </div>
  );
}
