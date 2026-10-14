import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AudioProvider } from "./AudioProvider";
import { AppLayout } from "./AppLayout";
import { PublicOnly, RequireAuth } from "./RouteGuards";

const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((module) => ({ default: module.DashboardPage }))
);
const DictionaryPage = lazy(() =>
  import("@/pages/DictionaryPage").then((module) => ({ default: module.DictionaryPage }))
);
const LoginPage = lazy(() =>
  import("@/pages/LoginPage").then((module) => ({ default: module.LoginPage }))
);
const StudyPage = lazy(() =>
  import("@/pages/StudyPage").then((module) => ({ default: module.StudyPage }))
);
const TopicsPage = lazy(() =>
  import("@/pages/TopicsPage").then((module) => ({ default: module.TopicsPage }))
);

function RouteLoader() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[#ECFDF5]" role="status" aria-label="Đang tải trang">
      <Loader2 className="h-8 w-8 animate-spin text-[#10b981]" />
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AudioProvider>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnly>
                  <LoginPage />
                </PublicOnly>
              }
            />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="dictionary" element={<DictionaryPage />} />
              <Route path="topics" element={<TopicsPage />} />
              <Route path="study" element={<StudyPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </Suspense>
        <Toaster position="top-right" richColors />
      </AudioProvider>
    </BrowserRouter>
  );
}
