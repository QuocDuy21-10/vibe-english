import { useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { Edit3, Trash2, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { db } from "@/lib/firebase";
import { playAudio } from "@/lib/audio";
import { handleFirestoreError } from "@/lib/firestoreErrors";
import { OperationType, Topic, Vocabulary } from "@/types/types";
import { EditVocabDialog } from "@/components/features/EditVocabDialog";

type VocabCardProps = {
  vocabulary: Vocabulary;
  topics: Topic[];
};

export function VocabCard({ vocabulary, topics }: VocabCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const topicName = topics.find((t) => t.id === vocabulary.topicId)?.name || "Chưa phân loại";

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
        <div className="absolute top-4 right-4 flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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
