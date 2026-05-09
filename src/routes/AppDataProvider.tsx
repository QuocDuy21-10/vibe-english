import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { toast } from "sonner";
import { auth, db } from "@/lib/firebase";
import type { Topic, Vocabulary } from "@/types/types";

type AppDataContextValue = {
  user: User | null;
  loading: boolean;
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setTopics([]);
      return;
    }
    const topicsQuery = query(
      collection(db, "topics"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(topicsQuery, (snapshot) => {
      setTopics(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Topic)));
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      setVocabularies([]);
      return;
    }
    const vocabQuery = query(
      collection(db, "vocabularies"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(vocabQuery, (snapshot) => {
      setVocabularies(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Vocabulary)));
    });
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

  const logout = useCallback(() => {
    return signOut(auth).then(() => toast.info("Đã đăng xuất."));
  }, []);

  const value = useMemo(
    () => ({ user, loading, topics, vocabularies, login, logout }),
    [user, loading, topics, vocabularies, login, logout]
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
