import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { DashboardPage } from "@/pages/DashboardPage";
import { DictionaryPage } from "@/pages/DictionaryPage";
import { LoginPage } from "@/pages/LoginPage";
import { StudyPage } from "@/pages/StudyPage";
import { TopicsPage } from "@/pages/TopicsPage";
import { AppLayout } from "./AppLayout";
import { PublicOnly, RequireAuth } from "./RouteGuards";

export function AppRouter() {
  return (
    <BrowserRouter>
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
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
}
