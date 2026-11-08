import { MotionConfig } from "motion/react";
import { AppDataProvider } from "@/routes/AppDataProvider";
import { AppRouter } from "@/routes/AppRouter";

export default function App() {
  return (
    // Honors the OS "reduce motion" setting: transform animations (card flip, slide-ins) jump to their end state.
    <MotionConfig reducedMotion="user">
      <AppDataProvider>
        <AppRouter />
      </AppDataProvider>
    </MotionConfig>
  );
}

