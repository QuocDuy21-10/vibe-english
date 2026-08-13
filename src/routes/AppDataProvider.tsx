import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { toast } from "sonner";
import { auth, db } from "@/lib/firebase";
import { handleFirestoreError } from "@/lib/firestoreErrors";
import { OperationType } from "@/types/types";
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
    const topicsQuery = query(
      collection(db, "topics"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(
      topicsQuery,
      (snapshot) => {
        setTopics(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Topic)));
        setTopicsLoading(false);
      },
      (error) => {
        setTopicsLoading(false);
        handleFirestoreError(error, OperationType.LIST, "topics");
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
    const vocabQuery = query(
      collection(db, "vocabularies"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(
      vocabQuery,
      (snapshot) => {
        setVocabularies(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Vocabulary)));
        setVocabulariesLoading(false);
      },
      (error) => {
        setVocabulariesLoading(false);
        handleFirestoreError(error, OperationType.LIST, "vocabularies");
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
      await signOut(auth);
      toast.info("Đã đăng xuất.");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Đăng xuất thất bại.");
    }
  }, []);

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
