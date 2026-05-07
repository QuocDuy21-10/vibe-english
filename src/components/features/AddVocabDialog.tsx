import React, { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { 
  DialogContent, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Topic, OperationType } from "@/types";
import { getWordDetails } from "@/services/geminiService";

export function AddVocabDialog({ onClose, userId, topics, handleFirestoreError }: { 
  onClose: () => void, 
  userId: string, 
  topics: Topic[],
  handleFirestoreError: (error: any, op: OperationType, path: string) => void
}) {
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
      const details = await getWordDetails(word);
      if (details) {
        setDefinition(details.definition || "");
        setPartOfSpeech(details.partOfSpeech || "");
        setPhonetic(details.phonetic || "");
      }
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
              <Select value={partOfSpeech} onValueChange={setPartOfSpeech}>
                <SelectTrigger className="rounded-xl h-11 border-slate-100">
                  <SelectValue placeholder="Chọn loại từ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="noun">Noun</SelectItem>
                  <SelectItem value="verb">Verb</SelectItem>
                  <SelectItem value="adjective">Adjective</SelectItem>
                  <SelectItem value="adverb">Adverb</SelectItem>
                  <SelectItem value="prep">Prep</SelectItem>
                  <SelectItem value="conj">Conj</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
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
