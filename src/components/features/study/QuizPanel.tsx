import { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Vocabulary } from "@/types/types";

const answerSchema = z.object({
  userAnswer: z.string().trim().min(1, "Vui lòng nhập câu trả lời.")
});

type AnswerFormValues = z.infer<typeof answerSchema>;

type QuizPanelProps = {
  vocabulary: Vocabulary;
  currentIndex: number;
  feedback: "correct" | "incorrect" | null;
  onAnswerChange: () => void;
  onCheckAnswer: (answer: string) => void;
  onRevealAnswer: () => void;
  onNext: () => void;
};

export function QuizPanel({
  vocabulary,
  currentIndex,
  feedback,
  onAnswerChange,
  onCheckAnswer,
  onRevealAnswer,
  onNext
}: QuizPanelProps) {
  const [isComposing, setIsComposing] = useState(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<AnswerFormValues>({
    resolver: zodResolver(answerSchema),
    defaultValues: { userAnswer: "" }
  });
  const { ref: userAnswerRef, ...userAnswerRegistration } = register("userAnswer", {
    onChange: onAnswerChange
  });
  const userAnswer = watch("userAnswer") ?? "";

  return (
    <motion.div
      key={`quiz-${vocabulary.id}-${currentIndex}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-8 flex flex-col items-center justify-between shadow-lg shadow-emerald-950/5 min-h-[380px] sm:min-h-[420px]"
    >
      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">ĐIỀN TỪ VÀO CHỖ TRỐNG</span>

      <div className="text-center mb-4 sm:mb-6 max-w-full">
        <p className="text-xs font-bold text-[#10b981] mb-1.5 uppercase tracking-wide">NGHĨA TIẾNG VIỆT</p>
        <h3 className="text-xl sm:text-3xl font-bold text-slate-900 leading-snug break-words px-2">{vocabulary.definition}</h3>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (feedback === "correct") {
            onNext();
          } else {
            void handleSubmit((data) => onCheckAnswer(data.userAnswer))(event);
          }
        }}
        className="w-full flex-grow flex flex-col justify-between items-center"
      >
        <div className="w-full max-w-xs flex flex-col items-center gap-2 my-auto">
          <div
            onClick={() => hiddenInputRef.current?.focus()}
            className="relative w-full flex justify-center items-center min-h-[56px] cursor-text"
          >
            <input
              type="text"
              autoFocus
              maxLength={vocabulary.word.length}
              className="absolute inset-0 opacity-0 cursor-default w-full h-full z-10"
              value={userAnswer}
              {...userAnswerRegistration}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={(event) => {
                setIsComposing(false);
                const value = event.currentTarget.value;
                const limit = vocabulary.word.length;
                if (value.length > limit) {
                  const truncated = value.slice(0, limit);
                  event.currentTarget.value = truncated;
                  setValue("userAnswer", truncated, { shouldDirty: true, shouldValidate: true });
                }
              }}
              onChange={(event) => {
                const limit = vocabulary.word.length;
                if (!isComposing && event.target.value.length > limit) {
                  event.target.value = event.target.value.slice(0, limit);
                }
                userAnswerRegistration.onChange(event);
              }}
              ref={(element) => {
                userAnswerRef(element);
                hiddenInputRef.current = element;
              }}
              aria-label="Nhập từ tiếng Anh"
            />

            <div className="flex gap-1 sm:gap-1.5 flex-wrap justify-center max-w-full" aria-hidden="true">
              {Array.from({ length: vocabulary.word.length }).map((_, index) => {
                const character = userAnswer[index] || "";
                const isActive = index === userAnswer.length;
                const isFilled = index < userAnswer.length;
                const isSpace = vocabulary.word[index] === " ";

                if (isSpace) return <div key={index} className="w-3 sm:w-4 h-10 sm:h-12" />;

                return (
                  <div
                    key={index}
                    className={cn(
                      "w-7 sm:w-8 h-10 sm:h-12 border-b-2 flex items-center justify-center transition-all duration-150 rounded-xs",
                      feedback === "correct"
                        ? "border-[#10b981] text-[#10b981] bg-[#ECFDF5]"
                        : feedback === "incorrect"
                          ? "border-rose-500 text-rose-700 bg-rose-50/30"
                          : isActive
                            ? "border-[#10b981] bg-[#ECFDF5]"
                            : isFilled
                              ? "border-slate-800"
                              : "border-slate-300"
                    )}
                  >
                    {character ? (
                      <span
                        className={cn(
                          "text-xl sm:text-2xl font-bold",
                          feedback === "correct"
                            ? "text-[#10b981]"
                            : feedback === "incorrect"
                              ? "text-rose-600"
                              : "text-slate-800"
                        )}
                      >
                        {character}
                      </span>
                    ) : isActive && !feedback ? (
                      <div className="h-5 sm:h-6 w-[2px] bg-[#10b981] cursor-blink-anim" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <span className="text-xs font-bold uppercase tracking-wider mt-2 text-slate-400">
            {Math.min(userAnswer.trim().length, vocabulary.word.length)}/{vocabulary.word.length} CHỮ CÁI
          </span>

          {errors.userAnswer && <p className="text-xs text-rose-500 font-medium text-center mt-1">{errors.userAnswer.message}</p>}
          {feedback === "incorrect" && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-xs font-semibold text-rose-500 mt-1"
            >
              Gợi ý: Từ này bắt đầu bằng chữ <span className="font-bold text-rose-700">"{vocabulary.word[0].toUpperCase()}"</span>
            </motion.p>
          )}
        </div>

        <div className="mt-6 w-full flex flex-col gap-2.5">
          {feedback === "correct" ? (
            <Button
              type="button"
              onClick={onNext}
              className="w-full h-12 bg-[#10b981] hover:bg-[#10b981]/90 text-white font-bold text-sm rounded-full shadow-md active:scale-95 transition-all duration-200 border-none cursor-pointer min-h-[48px]"
            >
              Làm tiếp câu khác
            </Button>
          ) : (
            <Button
              type="submit"
              className="w-full h-12 bg-[#10b981] hover:bg-[#10b981]/90 text-white font-bold text-sm rounded-full shadow-md active:scale-95 transition-all duration-200 border-none cursor-pointer disabled:opacity-50 min-h-[48px]"
            >
              Kiểm tra kết quả
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            className="w-full h-9 text-slate-400 hover:text-[#10b981] font-bold text-xs uppercase tracking-widest hover:bg-transparent cursor-pointer border-none"
            onClick={() => {
              setValue("userAnswer", vocabulary.word, { shouldDirty: true, shouldValidate: true });
              onRevealAnswer();
            }}
          >
            XEM ĐÁP ÁN
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
