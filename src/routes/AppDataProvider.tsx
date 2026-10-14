import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { runLogoutWithNotificationCleanup } from "@/lib/logout";
import { revokeVocabularyNotificationsForLogout } from "@/services/notificationService";
import { subscribeTopics } from "@/services/topicRepository";
import { subscribeVocabularies } from "@/services/vocabularyRepository";
import type { Topic, Vocabulary } from "@/types/types";

type AppDataContextValue = {
  user: User | null;
  loading: boolean;
  dataLoading: boolean;
  topics: Topic[];
  vocabularies: Vocabulary[];
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [vocabulariesLoading, setVocabulariesLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      },
      (error) => {
        console.error("Auth state error:", error);
        setUser(null);
        setLoading(false);
        toast.error("Không thể xác thực tài khoản.");
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setTopics([]);
      setTopicsLoading(false);
      return;
    }
    setTopicsLoading(true);
    return subscribeTopics(
      user.uid,
      (loadedTopics) => {
        setTopics(loadedTopics);
        setTopicsLoading(false);
      },
      () => {
        setTopicsLoading(false);
        toast.error("Không thể tải danh sách chủ đề.");
      }
    );
  }, [user]);

  useEffect(() => {
    if (!user) {
      setVocabularies([]);
      setVocabulariesLoading(false);
      return;
    }
    setVocabulariesLoading(true);
    return subscribeVocabularies(
      user.uid,
      (loadedVocab) => {
        setVocabularies(loadedVocab);
        setVocabulariesLoading(false);
      },
      () => {
        setVocabulariesLoading(false);
        toast.error("Không thể tải danh sách từ vựng.");
      }
    );
  }, [user]);

  const login = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success("Đăng nhập thành công!");
    } catch (error) {
      console.error(error);
      toast.error("Đăng nhập thất bại.");
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      let notificationCleanupError: unknown;
      const cleanupResult = await runLogoutWithNotificationCleanup(
        async () => {
          if (!user) return;
          try {
            await revokeVocabularyNotificationsForLogout(user.uid);
          } catch (error) {
            notificationCleanupError = error;
            throw error;
          }
        },
        () => signOut(auth),
        1_500
      );
      const notificationCleanupFailed = cleanupResult !== "completed";
      if (notificationCleanupFailed) {
        console.warn(
          "Notification cleanup was incomplete during logout",
          notificationCleanupError ?? cleanupResult
        );
      }
      toast.info(
        notificationCleanupFailed
          ? "Đã đăng xuất. Hãy kiểm tra lại quyền thông báo của trình duyệt."
          : "Đã đăng xuất."
      );
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Đăng xuất thất bại.");
    }
  }, [user]);

  const dataLoading = topicsLoading || vocabulariesLoading;

  const value = useMemo(
    () => ({ user, loading, dataLoading, topics, vocabularies, login, logout }),
    [user, loading, dataLoading, topics, vocabularies, login, logout]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return context;
}
