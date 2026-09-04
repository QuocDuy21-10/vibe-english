import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAppData } from "./AppDataProvider";

type GuardProps = {
  children: ReactNode;
};

function FullScreenLoader() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#ECFDF5]">
      <Loader2 className="w-8 h-8 animate-spin text-[#10b981]" />
    </div>
  );
}

export function RequireAuth({ children }: GuardProps) {
  const { user, loading } = useAppData();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function PublicOnly({ children }: GuardProps) {
  const { user, loading } = useAppData();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
