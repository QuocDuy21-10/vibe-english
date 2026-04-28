import React, { useState, useEffect } from "react";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc, 
  serverTimestamp,
  orderBy
} from "firebase/firestore";
import { 
  Plus, 
  LogOut, 
  BookOpen, 
  Layers, 
  Brain, 
  Search, 
  Trash2, 
  Edit3, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  Sparkles,
  SearchIcon,
  Volume2,
  Trophy,
  Check,
  LayoutDashboard,
  Target,
  Award,
  Zap
} from "lucide-react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  Tooltip as RechartsTooltip
} from "recharts";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "./components/ui/dialog";
import { Badge } from "./components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { ScrollArea } from "./components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { getWordDetails } from "./services/geminiService";

// Types
interface Topic {
  id: string;
  name: string;
  userId: string;
  createdAt: any;
}

interface Vocabulary {
  id: string;
  word: string;
  definition: string;
  partOfSpeech: string;
  phonetic: string;
  topicId: string;
  userId: string;
  createdAt: any;
  updatedAt: any;
  level: number;
  nextReview: any;
}

const SRS_INTERVALS = [1, 3, 7, 14, 30];

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper
const playAudio = (text: string) => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [topicSearchQuery, setTopicSearchQuery] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("all");
  const [isAddingVocab, setIsAddingVocab] = useState(false);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  
  // Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch topics
  useEffect(() => {
    if (!user) {
      setTopics([]);
      return;
    }
    const q = query(collection(db, "topics"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      setTopics(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic)));
    });
  }, [user]);

  // Fetch vocabularies
  useEffect(() => {
    if (!user) {
      setVocabularies([]);
      return;
    }
    const q = query(collection(db, "vocabularies"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      setVocabularies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vocabulary)));
    });
  }, [user]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success("Đăng nhập thành công!");
    } catch (error) {
      console.error(error);
      toast.error("Đăng nhập thất bại.");
    }
  };

  const logout = () => signOut(auth).then(() => toast.info("Đã đăng xuất."));

  const filteredVocab = vocabularies.filter(v => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = v.word.toLowerCase().includes(query) || 
                         v.definition.toLowerCase().includes(query) ||
                         (v.partOfSpeech && v.partOfSpeech.toLowerCase().includes(query));
    
    let matchesTopic = false;
    if (selectedTopicId === "all") {
      matchesTopic = true;
    } else if (selectedTopicId === "none") {
      matchesTopic = !v.topicId;
    } else {
      matchesTopic = v.topicId === selectedTopicId;
    }
    
    return matchesSearch && matchesTopic;
  });

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-emerald-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!user) {
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

  return (
    <div className="min-h-screen bg-emerald-50 text-slate-800">
      <header className="sticky top-0 z-50 w-full border-b border-emerald-100 bg-white/80 backdrop-blur-md">
        <div className="container max-w-5xl mx-auto h-16 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-md shadow-emerald-100">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-emerald-900 hidden sm:inline-block">Vibe English</span>
          </div>

          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700 hidden sm:flex font-bold uppercase text-[10px]">
              {vocabularies.length} từ vựng
            </Badge>
            <div className="flex items-center gap-2">
               <img 
                src={user.photoURL || ""} 
                alt={user.displayName || ""} 
                className="w-8 h-8 rounded-full border border-emerald-200 shadow-sm"
                referrerPolicy="no-referrer"
              />
              <Button variant="ghost" size="icon" onClick={logout} className="text-slate-500 hover:text-emerald-600 hover:bg-emerald-50">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto py-8 px-4">
        <Tabs defaultValue="dashboard" className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <TabsList className="bg-white p-1 rounded-xl w-fit border border-emerald-100 shadow-sm">
              <TabsTrigger value="dashboard" className="rounded-lg data-[state=active]:bg-emerald-500 data-[state=active]:text-white font-medium">
                <LayoutDashboard className="w-4 h-4 mr-2" /> Bảng tin
              </TabsTrigger>
              <TabsTrigger value="dictionary" className="rounded-lg data-[state=active]:bg-emerald-500 data-[state=active]:text-white font-medium">
                <BookOpen className="w-4 h-4 mr-2" /> Từ điển
              </TabsTrigger>
              <TabsTrigger value="topics" className="rounded-lg data-[state=active]:bg-emerald-500 data-[state=active]:text-white font-medium">
                <Layers className="w-4 h-4 mr-2" /> Chủ đề
              </TabsTrigger>
              <TabsTrigger value="study" className="rounded-lg data-[state=active]:bg-emerald-500 data-[state=active]:text-white font-medium">
                <Brain className="w-4 h-4 mr-2" /> Flashcard
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Dialog open={isAddingTopic} onOpenChange={setIsAddingTopic}>
                <DialogTrigger render={<Button variant="outline" size="sm" className="rounded-xl border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 transition-all shadow-sm" />}>
                    <Layers className="w-4 h-4 mr-2" /> Thêm chủ đề
                </DialogTrigger>
                <TopicDialog onClose={() => setIsAddingTopic(false)} userId={user.uid} />
              </Dialog>

              <Dialog open={isAddingVocab} onOpenChange={setIsAddingVocab}>
                <DialogTrigger render={<Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-100 border-none transition-all" />}>
                    <Plus className="w-4 h-4 mr-2" /> Thêm từ mới
                </DialogTrigger>
                <AddVocabDialog 
                  onClose={() => setIsAddingVocab(false)} 
                  userId={user.uid} 
                  topics={topics} 
                />
              </Dialog>
            </div>
          </div>

          <TabsContent value="dashboard" className="focus-visible:outline-none">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Mastered Card */}
                <Card className="md:col-span-2 rounded-[40px] border-none shadow-xl shadow-emerald-100 bg-gradient-to-br from-white to-emerald-50/30 overflow-hidden p-8 flex flex-col md:flex-row items-center gap-8">
                  <div className="flex-1 space-y-4 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 text-emerald-600 font-bold uppercase tracking-widest text-[10px]">
                      <Award className="w-4 h-4" />
                      Trạng thái thành thạo
                    </div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-tight">
                      Bạn đã chinh phục được <span className="text-emerald-500 underline decoration-emerald-200 decoration-8 underline-offset-4">{vocabularies.filter(v => (v.level || 0) === 4).length}</span> từ vựng!
                    </h1>
                    <p className="text-slate-500 font-medium">
                      Hãy tiếp tục duy trì đà học tập để mở khóa các cột mốc mới. Mỗi ngày một ít, tích tiểu thành đại.
                    </p>
                  </div>
                  <div className="w-48 h-48 shrink-0 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Mastered', value: vocabularies.filter(v => (v.level || 0) === 4).length, color: '#10b981' },
                            { name: 'Learning', value: vocabularies.filter(v => (v.level || 0) < 4).length, color: '#e2e8f0' }
                          ]}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell key="cell-0" fill="#10b981" />
                          <Cell key="cell-1" fill="#e2e8f0" />
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-black text-slate-800">
                        {Math.round((vocabularies.filter(v => (v.level || 0) === 4).length / (vocabularies.length || 1)) * 100)}%
                      </span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Tiến độ</span>
                    </div>
                  </div>
                </Card>

                {/* Next Milestone */}
                <Card className="rounded-[40px] border-none shadow-xl shadow-amber-100 bg-amber-500 p-8 text-white flex flex-col justify-between overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4 opacity-20 rotate-12">
                     <Target className="w-32 h-32" />
                  </div>
                  <div className="relative z-10 space-y-2">
                    <p className="text-amber-100/60 font-bold uppercase tracking-widest text-[10px]">Cột mốc tiếp theo</p>
                    <h2 className="text-2xl font-black">
                      {vocabularies.filter(v => (v.level || 0) === 4).length < 200 ? "Chiến binh 200" :
                       vocabularies.filter(v => (v.level || 0) === 4).length < 500 ? "Chuyên gia 500" : "Hồng sư 1000"}
                    </h2>
                  </div>
                  <div className="relative z-10 space-y-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold font-mono">
                         <span>{vocabularies.filter(v => (v.level || 0) === 4).length}</span>
                         <span>{vocabularies.filter(v => (v.level || 0) === 4).length < 200 ? 200 :
                                vocabularies.filter(v => (v.level || 0) === 4).length < 500 ? 500 : 1000}</span>
                      </div>
                      <div className="h-3 bg-white/20 rounded-full overflow-hidden border border-white/10">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (vocabularies.filter(v => (v.level || 0) === 4).length / (vocabularies.filter(v => (v.level || 0) === 4).length < 200 ? 200 : vocabularies.filter(v => (v.level || 0) === 4).length < 500 ? 500 : 1000)) * 100)}%` }}
                          className="h-full bg-white shadow-lg"
                        />
                      </div>
                    </div>
                    <p className="text-xs font-medium text-amber-50 italic">
                      "Kiến thức là chìa khóa mở cánh cửa tương lai."
                    </p>
                  </div>
                </Card>

                {/* Level Breakdown */}
                <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-5 gap-4">
                  {[0, 1, 2, 3, 4].map(lvl => (
                    <Card key={lvl} className="rounded-3xl border-none shadow-sm bg-white p-4 text-center space-y-1 group hover:bg-emerald-50 hover:shadow-emerald-50 transition-all cursor-default text-inherit">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-emerald-500">Level {lvl}</p>
                       <div className="text-2xl font-black text-slate-800">
                         {vocabularies.filter(v => (v.level || 0) === lvl).length}
                       </div>
                       <p className="text-[9px] font-medium text-slate-300 italic">
                         {lvl === 0 ? "Mới học" : lvl === 1 ? "Ghi nhớ" : lvl === 2 ? "Vững vàng" : lvl === 3 ? "Thành thạo" : "Bậc thầy"}
                       </p>
                    </Card>
                  ))}
                </div>

                {/* Quick Stats */}
                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-8 text-inherit">
                   <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-50 flex items-center gap-6">
                      <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                         <Zap className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-3xl font-black text-slate-800 tracking-tight">{vocabularies.length}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tổng vốn từ vựng</p>
                      </div>
                   </div>
                   <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-50 flex items-center gap-6">
                      <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                         <Trophy className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-3xl font-black text-slate-800 tracking-tight">{topics.length}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chủ đề đã tạo</p>
                      </div>
                   </div>
                </div>
             </div>
          </TabsContent>

          <TabsContent value="dictionary" className="space-y-6 focus-visible:outline-none">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Tìm kiếm từ vựng hoặc nghĩa..." 
                  className="pl-10 rounded-full border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm h-11"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={selectedTopicId} onValueChange={setSelectedTopicId}>
                <SelectTrigger className="w-full sm:w-[220px] rounded-full border-slate-200 bg-white h-11 shadow-sm">
                  <SelectValue placeholder="Tất cả chủ đề" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả bài học</SelectItem>
                  <SelectItem value="none">Chưa phân loại</SelectItem>
                  {topics.slice().sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
              <AnimatePresence mode="popLayout">
                    {filteredVocab.map((v) => (
                  <VocabCard key={v.id} vocabulary={v} topics={topics} />
                ))}
              </AnimatePresence>
            </div>

            {filteredVocab.length === 0 && (
              <div className="py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto opacity-50">
                  <Search className="w-8 h-8 text-emerald-600" />
                </div>
                <p className="text-emerald-800/60 italic font-medium">Không tìm thấy từ vựng nào.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="topics" className="focus-visible:outline-none space-y-6">
            <div className="relative max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Tìm kiếm chủ đề..." 
                className="pl-10 rounded-full border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm h-11"
                value={topicSearchQuery}
                onChange={(e) => setTopicSearchQuery(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {topics
                .filter(t => t.name.toLowerCase().includes(topicSearchQuery.toLowerCase()))
                .map(topic => (
                <Card key={topic.id} className="rounded-3xl border-slate-100 bg-white shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8 opacity-50 group-hover:bg-emerald-100 transition-colors"></div>
                  <CardHeader className="pb-2 relative">
                    <CardTitle className="text-xl font-bold text-slate-800 tracking-tight">{topic.name}</CardTitle>
                    <CardDescription className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                      {vocabularies.filter(v => v.topicId === topic.id).length} TỪ VỰNG
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="flex justify-end gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity relative">
                    <Dialog>
                      <DialogTrigger render={<Button variant="ghost" size="sm" className="text-slate-400 h-8 px-2 hover:text-emerald-600 hover:bg-emerald-50" />}>
                          <Edit3 className="w-4 h-4" />
                      </DialogTrigger>
                      <TopicDialog topic={topic} userId={user.uid} />
                    </Dialog>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-slate-400 h-8 px-2 hover:text-destructive hover:bg-rose-50"
                      onClick={async () => {
                        if (confirm("Xóa chủ đề này sẽ không xóa từ vựng, chúng sẽ được chuyển sang 'Chưa phân loại'. Bạn có chắc chắn?")) {
                          try {
                            await deleteDoc(doc(db, "topics", topic.id));
                            toast.success("Đã xóa chủ đề.");
                          } catch (e) {
                            handleFirestoreError(e, OperationType.DELETE, `topics/${topic.id}`);
                            toast.error("Lỗi khi xóa chủ đề.");
                          }
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
              {topics.length === 0 && (
                <div className="col-span-full py-20 text-center text-emerald-800/60 italic">
                  Chưa có chủ đề nào. Hãy tạo chủ đề ngay!
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="study" className="focus-visible:outline-none">
            <StudyArea vocabulary={vocabularies} topics={topics} />
          </TabsContent>
        </Tabs>
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}

// Subcomponents

function VocabCard({ vocabulary, topics }: { vocabulary: Vocabulary; topics: Topic[]; key?: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const topicName = topics.find(t => t.id === vocabulary.topicId)?.name || "Chưa phân loại";

  const handleDelete = async () => {
    if (confirm(`Xóa từ "${vocabulary.word}"?`)) {
      try {
        await deleteDoc(doc(db, "vocabularies", vocabulary.id));
        toast.info("Đã xóa từ vựng.");
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `vocabularies/${vocabulary.id}`);
        toast.error("Lỗi khi xóa từ vựng.");
      }
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="rounded-3xl border-slate-100 bg-white shadow-sm hover:shadow-md hover:bg-emerald-50/30 transition-all overflow-hidden relative group">
        <CardHeader className="pb-3 pr-10">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border-none">
                {vocabulary.partOfSpeech || "n/a"}
              </Badge>
              {vocabulary.level > 0 && (
                <Badge variant="outline" className="border-emerald-200 text-emerald-600 text-[9px] font-bold px-1.5 py-0 rounded-md">
                  Lvl {vocabulary.level}
                </Badge>
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{topicName}</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <CardTitle className="text-2xl font-bold text-emerald-700 tracking-tight">{vocabulary.word}</CardTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700"
              onClick={() => playAudio(vocabulary.word)}
            >
              <Volume2 className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-slate-400 font-medium italic">/ {vocabulary.phonetic} /</p>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-lg font-bold text-slate-800 leading-snug">{vocabulary.definition}</p>
        </CardContent>
        <div className="absolute top-4 right-4 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-100/50" />}>
                <Edit3 className="w-4 h-4" />
            </DialogTrigger>
            <EditVocabDialog vocabulary={vocabulary} topics={topics} onClose={() => setIsEditing(false)} />
          </Dialog>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-rose-50" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

function TopicDialog({ onClose, userId, topic }: { onClose?: () => void, userId: string, topic?: Topic }) {
  const [name, setName] = useState(topic?.name || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (topic) {
        await updateDoc(doc(db, "topics", topic.id), {
          name: name.trim()
        });
        toast.success("Đã cập nhật chủ đề!");
      } else {
        await addDoc(collection(db, "topics"), {
          name: name.trim(),
          userId,
          createdAt: serverTimestamp()
        });
        toast.success("Đã thêm chủ đề mới!");
      }
      onClose?.();
    } catch (e) {
      if (e instanceof Error && e.message.includes('{"error"')) {
         // Already handled
      } else {
         handleFirestoreError(e, topic ? OperationType.UPDATE : OperationType.CREATE, "topics");
      }
      toast.error("Lỗi khi xử lý chủ đề.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold">{topic ? "Chỉnh sửa chủ đề" : "Thêm chủ đề mới"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 pt-4">
        <Input 
          placeholder="Tên chủ đề (ví dụ: Công việc, Du lịch...)" 
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          className="rounded-xl h-11 border-slate-200 focus:ring-emerald-500"
        />
        <DialogFooter>
          {onClose && <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">Hủy</Button>}
          <Button type="submit" disabled={loading} className="bg-emerald-500 hover:bg-emerald-600 rounded-xl border-none">
            {loading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : (topic ? "Cập nhật" : "Thêm chủ đề")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function AddVocabDialog({ onClose, userId, topics }: { onClose: () => void, userId: string, topics: Topic[] }) {
  const [word, setWord] = useState("");
  const [definition, setDefinition] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("");
  const [phonetic, setPhonetic] = useState("");
  const [topicId, setTopicId] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleAiLookup = async () => {
    if (!word.trim()) return;
    setIsAiLoading(true);
    try {
      const details = await getWordDetails(word.trim());
      setDefinition(details.definition);
      setPartOfSpeech(details.partOfSpeech);
      setPhonetic(details.phonetic);
      toast.success("AI đã hoàn tất tra cứu! ✨");
    } catch (e) {
      toast.error("Không thể lấy thông tin từ AI.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !definition.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "vocabularies"), {
        word: word.trim(),
        definition: definition.trim(),
        partOfSpeech: partOfSpeech.trim(),
        phonetic: phonetic.trim(),
        topicId: topicId || null,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        level: 0,
        nextReview: serverTimestamp()
      });
      toast.success("Đã thêm từ vựng!");
      onClose();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, "vocabularies");
      toast.error("Lỗi khi thêm từ vựng.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-lg rounded-[2rem] overflow-hidden p-0 border-none shadow-2xl">
      <div className="bg-emerald-500 p-8 text-white text-center shadow-inner">
        <DialogTitle className="text-3xl font-bold tracking-tight">Thêm từ mới</DialogTitle>
        <p className="text-white/80 text-sm font-medium mt-1">Mỗi từ mới là một bước tiến mới</p>
      </div>
      <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-white">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Input 
              placeholder="Nhập từ tiếng Anh..." 
              value={word}
              onChange={e => setWord(e.target.value)}
              className="rounded-xl h-12 text-lg border-slate-200 focus:ring-emerald-500"
            />
          </div>
          <Button 
            type="button" 
            variant="outline" 
            className="h-12 rounded-xl border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
            onClick={handleAiLookup}
            disabled={isAiLoading || !word.trim()}
          >
            {isAiLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4 mr-2" />}
            AI Tra
          </Button>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Phiên âm</label>
              <Input 
                placeholder="/Phonetic/" 
                value={phonetic}
                onChange={e => setPhonetic(e.target.value)}
                className="rounded-xl h-11 border-slate-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Loại từ</label>
              <Input 
                placeholder="n, v, adj..." 
                value={partOfSpeech}
                onChange={e => setPartOfSpeech(e.target.value)}
                className="rounded-xl h-11 border-slate-100"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Định nghĩa</label>
            <Input 
              placeholder="Nghĩa tiếng Việt..." 
              value={definition}
              onChange={e => setDefinition(e.target.value)}
              className="rounded-xl h-11 border-slate-100 font-bold text-emerald-700"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Chủ đề</label>
            <Select value={topicId} onValueChange={setTopicId}>
              <SelectTrigger className="rounded-xl h-11 border-slate-100">
                <SelectValue placeholder="Chọn chủ đề" />
              </SelectTrigger>
              <SelectContent>
                {topics.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="pt-4 flex !justify-between items-center sm:!flex-row gap-4">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl text-slate-400">Bỏ qua</Button>
          <Button type="submit" disabled={loading} className="bg-emerald-500 hover:bg-emerald-600 h-12 px-10 rounded-xl shadow-lg shadow-emerald-100 border-none transition-all">
            {loading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : "Lưu vào từ điển"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function EditVocabDialog({ vocabulary, topics, onClose }: { vocabulary: Vocabulary, topics: Topic[], onClose: () => void }) {
  const [word, setWord] = useState(vocabulary.word);
  const [definition, setDefinition] = useState(vocabulary.definition);
  const [partOfSpeech, setPartOfSpeech] = useState(vocabulary.partOfSpeech);
  const [phonetic, setPhonetic] = useState(vocabulary.phonetic);
  const [topicId, setTopicId] = useState(vocabulary.topicId || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateDoc(doc(db, "vocabularies", vocabulary.id), {
        word: word.trim(),
        definition: definition.trim(),
        partOfSpeech: partOfSpeech.trim(),
        phonetic: phonetic.trim(),
        topicId: topicId || null,
        updatedAt: serverTimestamp()
      });
      toast.success("Đã cập nhật!");
      onClose();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `vocabularies/${vocabulary.id}`);
      toast.error("Lỗi khi cập nhật.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold text-slate-800">Chỉnh sửa từ vựng</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 pt-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Từ vựng</label>
          <Input placeholder="Từ tiếng Anh" value={word} onChange={e => setWord(e.target.value)} className="rounded-xl h-11 border-slate-100 font-bold" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Phiên âm</label>
            <Input placeholder="Phonetic" value={phonetic} onChange={e => setPhonetic(e.target.value)} className="rounded-xl h-11 border-slate-100" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Loại từ</label>
            <Input placeholder="Loại từ" value={partOfSpeech} onChange={e => setPartOfSpeech(e.target.value)} className="rounded-xl h-11 border-slate-100" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Định nghĩa</label>
          <Input placeholder="Nghĩa" value={definition} onChange={e => setDefinition(e.target.value)} className="rounded-xl h-11 border-slate-100 font-bold text-emerald-700" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Chủ đề</label>
          <Select value={topicId} onValueChange={setTopicId}>
            <SelectTrigger className="rounded-xl h-11 border-slate-100 bg-white">
              <SelectValue placeholder="Chọn chủ đề" />
            </SelectTrigger>
            <SelectContent>
              {topics.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="pt-4">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl text-slate-400">Hủy</Button>
          <Button type="submit" disabled={loading} className="bg-emerald-500 hover:bg-emerald-600 rounded-xl border-none shadow-lg shadow-emerald-50 transition-all">
            {loading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function StudyArea({ vocabulary, topics }: { vocabulary: Vocabulary[], topics: Topic[] }) {
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [view, setView] = useState<"topics" | "study" | "summary">("topics");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyMode, setStudyMode] = useState<"flashcard" | "quiz">("flashcard");
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [quizVocab, setQuizVocab] = useState<Vocabulary[]>([]);
  const [score, setScore] = useState(0);

  const filtered = quizVocab.length > 0 ? quizVocab : vocabulary.filter(v => selectedTopic === "all" || v.topicId === selectedTopic);

  const reset = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setUserAnswer("");
    setFeedback(null);
    if (view === "topics") {
      setQuizVocab([]);
      setScore(0);
    }
  };

  useEffect(() => {
    reset();
  }, [selectedTopic, studyMode, view]);

  const startQuickQuiz = () => {
    const shuffled = [...vocabulary].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);
    setQuizVocab(selected);
    setSelectedTopic("quick_quiz");
    setStudyMode("quiz");
    setView("study");
    setScore(0);
  };

  const startReviewSRS = () => {
    const now = new Date();
    const due = vocabulary.filter(v => {
      if (!v.nextReview) return true;
      const nextDate = v.nextReview.toDate ? v.nextReview.toDate() : new Date(v.nextReview);
      return nextDate <= now;
    });
    
    if (due.length === 0) {
      toast.info("Bạn đã hoàn thành hết các mục cần ôn tập! ✨");
      return;
    }
    
    setQuizVocab(due);
    setSelectedTopic("srs_review");
    setStudyMode("quiz");
    setView("study");
    setScore(0);
  };

  const selectTopic = (topicId: string) => {
    setSelectedTopic(topicId);
    setQuizVocab([]);
    setView("study");
  };

  const next = () => {
    if (currentIndex < filtered.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
      setUserAnswer("");
      setFeedback(null);
    } else {
      setView("summary");
    }
  };

  const prev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsFlipped(false);
      setUserAnswer("");
      setFeedback(null);
    }
  };

  const checkAnswer = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userAnswer.trim()) return;

    const currentVocab = filtered[currentIndex];
    const isCorrect = userAnswer.trim().toLowerCase() === currentVocab.word.trim().toLowerCase();
    
    if (!feedback) { // Only update SRS and count score on first attempt
      if (isCorrect) setScore(prev => prev + 1);
      
      // SRS Calculation
      let newLevel = 0;
      if (isCorrect) {
        newLevel = Math.min(SRS_INTERVALS.length - 1, (currentVocab.level || 0) + 1);
      } else {
        newLevel = 0; 
      }
      
      const daysToAdd = SRS_INTERVALS[newLevel];
      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + daysToAdd);
      
      try {
        await updateDoc(doc(db, "vocabularies", currentVocab.id), {
          level: newLevel,
          nextReview: nextReview,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `vocabularies/${currentVocab.id}`);
        console.error("SRS Update Error:", err);
      }
    }

    setFeedback(isCorrect ? "correct" : "incorrect");
    
    if (isCorrect) {
      toast.success("Chính xác! ✨");
    } else {
      toast.error("Chưa đúng rồi, hãy thử lại nhé!");
    }
  };

  if (view === "summary") {
    const accuracy = filtered.length > 0 ? Math.round((score / filtered.length) * 100) : 0;
    const isPerfect = accuracy === 100;

    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-8">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-[40px] p-10 shadow-xl border border-emerald-50 space-y-8"
        >
          <div className="relative">
            <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-100 relative z-10">
               <Trophy className="w-12 h-12 text-white" />
            </div>
            {isPerfect && (
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 bg-emerald-400 rounded-full blur-2xl opacity-20"
              />
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-4xl font-black text-slate-800 tracking-tight">
              {isPerfect ? "Tuyệt vời! ✨" : accuracy >= 80 ? "Rất tốt! 👏" : accuracy >= 50 ? "Khá lắm! 👍" : "Cố gắng lên! 💪"}
            </h2>
            <p className="text-slate-500 font-medium">Bạn đã hoàn thành bài học {selectedTopic === "quick_quiz" ? "thử thách 10 từ vựng" : "chủ đề này"}.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="py-6 px-4 bg-emerald-50 rounded-3xl space-y-1">
               <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Độ chính xác</p>
               <div className="text-3xl font-black text-emerald-700">{accuracy}%</div>
            </div>
            <div className="py-6 px-4 bg-slate-50 rounded-3xl space-y-1">
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Số câu đúng</p>
               <div className="text-3xl font-black text-slate-700">{score}/{filtered.length}</div>
            </div>
            <div className="py-6 px-4 bg-rose-50 rounded-3xl space-y-1">
               <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Cần cải thiện</p>
               <div className="text-3xl font-black text-rose-700">{filtered.length - score}</div>
            </div>
          </div>

          {studyMode === "flashcard" && (
            <div className="py-4 px-6 bg-emerald-900 rounded-2xl text-white">
              <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Thống kê Flashcard</p>
              <div className="text-xl font-bold">{filtered.length} từ vựng đã được ôn tập qua thẻ</div>
            </div>
          )}

          <div className="pt-4 space-y-3">
            <Button 
              onClick={() => setView("topics")}
              className="w-full h-14 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-lg shadow-lg border-none"
            >
              Quay lại trang chủ học tập
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => {
                reset();
                setView("study");
              }}
              className="w-full h-12 text-emerald-600 font-bold hover:bg-emerald-50"
            >
              Học lại ngay
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (view === "topics") {
    const filteredTopics = topics.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Chọn chủ đề ôn tập</h2>
          <p className="text-slate-500 font-medium">Bắt đầu bài học Flashcard của bạn ngay hôm nay</p>
        </div>

        <div className="relative max-w-md mx-auto">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Tìm kiếm chủ đề ôn tập..." 
            className="pl-10 rounded-full border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm h-11"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div 
            whileHover={{ y: -5 }}
            className="cursor-pointer group"
            onClick={startReviewSRS}
          >
            <Card className="h-full border-none shadow-lg shadow-emerald-200/50 hover:shadow-emerald-400/50 transition-all overflow-hidden rounded-[32px] bg-emerald-600 border-b-8 border-emerald-800">
              <CardHeader className="pt-8 pb-4 text-center">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white group-hover:scale-110 transition-transform">
                   <Brain className="w-8 h-8" />
                </div>
                <CardTitle className="text-xl font-bold text-white">Cần ôn tập</CardTitle>
                <CardDescription className="text-emerald-100/60 font-medium tracking-wide uppercase text-[10px]">
                  {vocabulary.filter(v => {
                    const nextDate = v.nextReview?.toDate ? v.nextReview.toDate() : (v.nextReview ? new Date(v.nextReview) : new Date());
                    return nextDate <= new Date();
                  }).length} từ đến hạn
                </CardDescription>
              </CardHeader>
            </Card>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="cursor-pointer group"
            onClick={startQuickQuiz}
          >
            <Card className="h-full border-none shadow-lg shadow-amber-200/50 hover:shadow-amber-400/50 transition-all overflow-hidden rounded-[32px] bg-gradient-to-br from-amber-500 to-amber-600 border-b-8 border-amber-700">
              <CardHeader className="pt-8 pb-4 text-center">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white group-hover:scale-110 transition-transform">
                   <Trophy className="w-8 h-8" />
                </div>
                <CardTitle className="text-xl font-bold text-white">Kiểm tra nhanh</CardTitle>
                <CardDescription className="text-amber-100/60 font-medium tracking-wide uppercase text-[10px]">10 từ ngẫu nhiên</CardDescription>
              </CardHeader>
            </Card>
          </motion.div>

          {(!searchQuery || "tất cả bài học".includes(searchQuery.toLowerCase())) && (
            <motion.div 
              whileHover={{ y: -5 }}
              className="cursor-pointer group"
              onClick={() => selectTopic("all")}
            >
              <Card className="h-full border-none shadow-lg shadow-slate-200/50 hover:shadow-emerald-200/50 transition-all overflow-hidden rounded-[32px] bg-emerald-900 border-b-8 border-emerald-700">
                <CardHeader className="pt-8 pb-4 text-center">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-400 group-hover:scale-110 transition-transform">
                     <BookOpen className="w-8 h-8" />
                  </div>
                  <CardTitle className="text-xl font-bold text-white">Tất cả bài học</CardTitle>
                  <CardDescription className="text-emerald-300/60">{vocabulary.length} từ vựng</CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          )}

          {filteredTopics.map(topic => {
            const topicVocabCount = vocabulary.filter(v => v.topicId === topic.id).length;
            return (
              <motion.div 
                key={topic.id}
                whileHover={{ y: -5 }}
                className="cursor-pointer group"
                onClick={() => selectTopic(topic.id)}
              >
                <Card className="h-full border-2 border-transparent bg-white shadow-lg shadow-slate-200/50 hover:shadow-emerald-100 transition-all overflow-hidden rounded-[32px] border-b-8 border-emerald-50 relative group-hover:border-emerald-500/20">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Brain className="w-24 h-24 text-emerald-900" />
                  </div>
                  <CardHeader className="pt-8 pb-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 text-emerald-600">
                      <Layers className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-lg font-bold text-slate-800 line-clamp-1">{topic.name}</CardTitle>
                    <CardDescription className="text-slate-400 font-medium">{topicVocabCount} từ vựng</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex -space-x-2">
                       {[1,2,3].map(i => (
                         <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400">
                           {i}
                         </div>
                       ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="py-20 text-center space-y-6">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm text-emerald-500">
          <Brain className="w-10 h-10" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xl font-bold text-slate-900">Chủ đề này chưa có từ vựng</p>
            <p className="text-slate-400 text-sm italic">Hãy thêm từ vựng vào chủ đề để bắt đầu học với Flashcard.</p>
          </div>
          <Button 
            variant="ghost" 
            onClick={() => setView("topics")}
            className="text-emerald-600 hover:text-emerald-700 font-bold"
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> Quay lại chọn chủ đề
          </Button>
        </div>
      </div>
    );
  }

  const current = filtered[currentIndex];

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setView("topics")}
            className="text-slate-400 hover:text-emerald-600 p-0 h-auto"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Danh sách chủ đề
          </Button>
          
          <div className="flex items-center p-1 bg-white rounded-xl border border-emerald-100 shadow-sm">
            <Button 
              variant="ghost" 
              size="sm" 
              className={`rounded-lg px-4 h-9 ${studyMode === "flashcard" ? "bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white" : "text-slate-500"}`}
              onClick={() => setStudyMode("flashcard")}
            >
              Flashcard
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={`rounded-lg px-4 h-9 ${studyMode === "quiz" ? "bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white" : "text-slate-500"}`}
              onClick={() => setStudyMode("quiz")}
            >
              Điền từ
            </Button>
          </div>
          <div className="w-[100px]" /> {/* Spacer */}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">
              {selectedTopic === "all" ? "Tất cả bài học" : 
               selectedTopic === "quick_quiz" ? "Kiểm tra nhanh" :
               selectedTopic === "srs_review" ? "Ôn tập đến hạn" :
               topics.find(t => t.id === selectedTopic)?.name}
            </h3>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              {selectedTopic === "srs_review" ? "Thuật toán SRS Spaced Repetition" : 
               selectedTopic === "quick_quiz" ? "Thử thách 10 từ vựng" : "Đang ôn tập"}
            </p>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 tracking-widest uppercase bg-emerald-100 px-3 py-1 rounded-full">
            {currentIndex + 1} / {filtered.length} {studyMode === "flashcard" ? "THẺ" : "CÂU"}
          </span>
        </div>
        <div className="w-full h-1.5 bg-emerald-100 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / filtered.length) * 100}%` }}
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 sm:gap-8 justify-center min-h-[500px]">
        <Button 
          variant="outline" 
          size="icon" 
          className="hidden sm:flex w-14 h-14 rounded-full bg-white border-none shadow-lg shadow-emerald-100 ring-1 ring-emerald-50 hover:translate-y-[-2px] transition-all disabled:opacity-30 shrink-0" 
          onClick={(e) => { e.stopPropagation(); prev(); }}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="w-6 h-6 text-emerald-600" />
        </Button>

        <div className="flex-1 max-w-2xl">
          {studyMode === "flashcard" ? (
            <div className="relative h-[480px] perspective-1000">
              <motion.div
                 key={currentIndex}
                 initial={{ opacity: 0, scale: 0.9, y: 20 }}
                 animate={{ 
                   opacity: 1, 
                   scale: 1,
                   y: 0,
                   rotateY: isFlipped ? 180 : 0 
                 }}
                 transition={{ 
                   opacity: { duration: 0.3 },
                   rotateY: { duration: 0.6, type: "spring", stiffness: 260, damping: 25 },
                   y: { duration: 0.4, type: "spring" }
                 }}
                 className="w-full h-full cursor-pointer relative shadow-xl rounded-[40px]"
                 style={{ transformStyle: "preserve-3d" }}
                 onClick={() => setIsFlipped(!isFlipped)}
              >
                {/* Front: Tiếng Anh */}
                <div className="absolute inset-0 backface-hidden w-full h-full rounded-[40px] bg-white flex flex-col items-center justify-center p-8 text-center border-b-8 border-emerald-400 overflow-hidden shadow-lg">
                   <motion.div 
                     animate={{ opacity: isFlipped ? 0 : 1, y: isFlipped ? 10 : 0 }}
                     className="flex flex-col items-center"
                   >
                     <div className="absolute top-8 left-8 opacity-10">
                       <BookOpen className="w-20 h-20 text-emerald-500" />
                     </div>
                     <div className="absolute top-4 left-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest">Flashcard Mode</div>
                     
                     <Badge variant="outline" className="mb-6 rounded-lg border-emerald-100 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider px-3 py-1">
                       {current.partOfSpeech || "Vocabulary"}
                     </Badge>
                     <div className="flex items-center gap-4 mb-3">
                       <h2 className="text-5xl font-black text-slate-800 tracking-tight">{current.word}</h2>
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="w-12 h-12 rounded-full text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                         onClick={(e) => {
                           e.stopPropagation();
                           playAudio(current.word);
                         }}
                       >
                         <Volume2 className="w-8 h-8" />
                       </Button>
                     </div>
                     <p className="text-xl font-medium text-slate-400">/ {current.phonetic} /</p>
                     
                     <div className="mt-12 flex items-center gap-3 text-slate-400 animate-pulse">
                        <Brain className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm font-medium uppercase tracking-widest text-[10px]">Nhấn để xem nghĩa tiếng Việt</span>
                     </div>
                   </motion.div>
                </div>

                {/* Back: Tiếng Việt */}
                <div 
                  className="absolute inset-0 backface-hidden w-full h-full rounded-[40px] bg-emerald-900 flex flex-col items-center justify-center p-8 text-center"
                  style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
                >
                   <motion.div 
                     animate={{ opacity: isFlipped ? 1 : 0, scale: isFlipped ? 1 : 0.8 }}
                     transition={{ delay: 0.1 }}
                     className="flex flex-col items-center"
                   >
                     <div className="absolute top-8 right-8 opacity-10">
                       <Brain className="w-20 h-20 text-emerald-400" />
                     </div>
                     <p className="text-emerald-400/60 text-[10px] font-bold uppercase tracking-widest mb-6">Nghĩa Tiếng Việt</p>
                     <h3 className="text-4xl font-bold text-white leading-relaxed tracking-tight">{current.definition}</h3>
                     <p className="absolute bottom-10 text-[10px] text-white/40 font-bold uppercase tracking-[0.2em]">Nhấn để quay lại</p>
                   </motion.div>
                </div>
              </motion.div>
            </div>
          ) : (
            <motion.div 
              key={`quiz-${currentIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-[40px] p-8 shadow-xl border border-emerald-50 h-[480px] flex flex-col items-center justify-between"
            >
              <div className="w-full text-center space-y-6">
                <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">Fill in the blanks</div>
                <div className="space-y-4">
                  <p className="text-emerald-600/60 text-xs font-bold uppercase tracking-widest">Nghĩa Tiếng Việt</p>
                  <h3 className="text-3xl font-black text-slate-800 leading-tight">{current.definition}</h3>
                </div>
              </div>

              <form onSubmit={checkAnswer} className="w-full space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-4">Từ tiếng Anh của bạn</label>
                    <div className="relative">
                      <input 
                        autoFocus
                        placeholder="..." 
                        value={userAnswer}
                        onChange={(e) => {
                          setUserAnswer(e.target.value);
                          if (feedback) setFeedback(null);
                        }}
                        className={`w-full h-16 text-2xl font-bold text-center rounded-2xl border-2 transition-all outline-none bg-white ${
                          feedback === "correct" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : 
                          feedback === "incorrect" ? "border-rose-500 bg-rose-50 text-rose-700" : 
                          "border-slate-100 focus:border-emerald-500"
                        }`}
                      />
                      {feedback === "correct" && <Sparkles className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 w-6 h-6 animate-bounce" />}
                    </div>
                 </div>

                 <Button 
                    type="submit" 
                    disabled={!userAnswer.trim()}
                    className={`w-full h-14 rounded-2xl text-lg font-bold shadow-lg transition-all border-none ${
                       feedback === "correct" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-slate-800 hover:bg-slate-900"
                    }`}
                 >
                    {feedback === "correct" ? "Làm tiếp câu khác" : "Kiểm tra kết quả"}
                 </Button>

                 {feedback === "incorrect" && (
                    <motion.p 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center text-sm font-medium text-rose-500"
                    >
                      Gợi ý: Từ này bắt đầu bằng chữ <span className="font-bold text-rose-700">"{current.word[0].toUpperCase()}"</span>
                    </motion.p>
                 )}
              </form>

              <div className="w-full pt-4 border-t border-slate-50 flex justify-center">
                 <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-emerald-500"
                  onClick={() => {
                    setUserAnswer(current.word);
                    setFeedback("correct");
                  }}
                 >
                   Xem đáp án
                 </Button>
              </div>
            </motion.div>
          )}
        </div>

        <Button 
          variant="outline" 
          size="icon" 
          className="hidden sm:flex w-14 h-14 rounded-full bg-white border-none shadow-lg shadow-emerald-100 ring-1 ring-emerald-50 hover:translate-y-[-2px] transition-all disabled:opacity-30 shrink-0" 
          onClick={(e) => { e.stopPropagation(); next(); }}
        >
          {currentIndex === filtered.length - 1 ? (
            <Check className="w-6 h-6 text-emerald-600" />
          ) : (
            <ChevronRight className="w-6 h-6 text-emerald-600" />
          )}
        </Button>
      </div>

      <div className="flex items-center justify-center gap-6 pt-4 sm:hidden">
        <Button 
          variant="outline" 
          size="icon" 
          className="w-14 h-14 rounded-full bg-white border-none shadow-lg shadow-emerald-100 ring-1 ring-emerald-50 hover:translate-y-[-2px] transition-all disabled:opacity-30" 
          onClick={(e) => { e.stopPropagation(); prev(); }}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="w-6 h-6 text-emerald-600" />
        </Button>
        <Button 
          variant="outline" 
          size="icon" 
          className="w-14 h-14 rounded-full bg-white border-none shadow-lg shadow-emerald-100 ring-1 ring-emerald-50 hover:translate-y-[-2px] transition-all disabled:opacity-30" 
          onClick={(e) => { e.stopPropagation(); next(); }}
        >
          {currentIndex === filtered.length - 1 ? (
            <Check className="w-6 h-6 text-emerald-600" />
          ) : (
            <ChevronRight className="w-6 h-6 text-emerald-600" />
          )}
        </Button>
      </div>
    </div>
  );
}

