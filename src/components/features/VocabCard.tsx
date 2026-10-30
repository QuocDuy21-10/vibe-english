import { memo, useState } from "react";
import { Edit3, Tags, Trash2, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { getVocabularyLevel } from "@/lib/srs";
import { useAudioActions } from "@/routes/AudioProvider";
import { deleteVocabulary } from "@/services/vocabularyRepository";
import type { Topic, Vocabulary } from "@/types/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditVocabDialog } from "@/components/features/EditVocabDialog";

type VocabCardProps = {
  vocabulary: Vocabulary;
  topics: Topic[];
  topicName: string;
  synonymLabels: string[];
  vocabularies?: Vocabulary[];
};

const EMPTY_VOCABULARIES: Vocabulary[] = [];

export const VocabCard = memo(function VocabCard({
  vocabulary,
  topics,
  topicName,
  synonymLabels,
  vocabularies = EMPTY_VOCABULARIES
}: VocabCardProps) {
  const { speak } = useAudioActions();
  const [isEditing, setIsEditing] = useState(false);
  // Keeps the edit form mounted only while open or animating closed, so idle cards skip useForm setup.
  const [isEditDialogMounted, setIsEditDialogMounted] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const level = getVocabularyLevel(vocabulary);

  const handleDelete = async () => {
    try {
      await deleteVocabulary(vocabulary.id);
      toast.info("Đã xóa từ vựng.");
      setShowDeleteConfirm(false);
    } catch {
      toast.error("Lỗi khi xóa từ vựng.");
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
      <Card className="h-full rounded-2xl sm:rounded-3xl border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-[#10b981]/40 hover:bg-[#ECFDF5]/20 transition-all overflow-hidden relative flex flex-col justify-between">
        <CardHeader className="pb-2 pr-12">
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="secondary" className="bg-[#ECFDF5] text-[#10b981] text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border-none">
                {vocabulary.partOfSpeech || "n/a"}
              </Badge>
              {level > 0 && (
                <Badge variant="outline" className="border-[#10b981]/40 text-[#10b981] text-[10px] font-bold px-1.5 py-0 rounded-md">
                  Lvl {level}
                </Badge>
              )}
            </div>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider ml-auto text-right break-words">{topicName}</span>
          </div>

          <div className="flex items-center gap-2 mb-1 min-w-0">
            <CardTitle className="text-xl sm:text-2xl font-bold text-[#10b981] tracking-tight break-words min-w-0 flex-1">
              {vocabulary.word}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-full text-[#10b981] hover:bg-[#ECFDF5] hover:text-[#10b981] border-none shrink-0"
              onClick={() => void speak(vocabulary.word)}
              aria-label={`Phát âm ${vocabulary.word}`}
            >
              <Volume2 className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 font-medium italic break-words">{vocabulary.phonetic || "—"}</p>
        </CardHeader>

        <CardContent className="pb-4 pt-1 flex-grow space-y-3">
          <p className="text-base sm:text-lg font-bold text-slate-800 leading-snug break-words">{vocabulary.definition}</p>
          {synonymLabels.length > 0 && (
            <div className="space-y-1.5 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <Tags className="size-3.5 text-[#10b981]" aria-hidden="true" />
                <span>Từ đồng nghĩa</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {synonymLabels.map((word) => (
                  <Badge
                    key={word.toLocaleLowerCase()}
                    variant="secondary"
                    className="max-w-full bg-[#ECFDF5] px-2 py-1 text-[11px] font-semibold text-[#065F46]"
                  >
                    <span className="truncate">{word}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>

        <div className="absolute top-3.5 right-3 flex flex-col gap-1">
          <Dialog
            open={isEditing}
            onOpenChange={(open) => {
              if (open) setIsEditDialogMounted(true);
              setIsEditing(open);
            }}
            onOpenChangeComplete={(open) => {
              if (!open) setIsEditDialogMounted(false);
            }}
          >
            <DialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-9 h-9 min-w-[36px] rounded-full text-slate-400 hover:text-[#10b981] hover:bg-[#ECFDF5] border-none cursor-pointer"
                  aria-label={`Chỉnh sửa từ ${vocabulary.word}`}
                />
              }
            >
              <Edit3 className="w-4 h-4" />
            </DialogTrigger>
            {isEditDialogMounted && (
              <EditVocabDialog
                vocabulary={vocabulary}
                topics={topics}
                vocabularies={vocabularies}
                onClose={() => setIsEditing(false)}
              />
            )}
          </Dialog>

          <Button
            variant="ghost"
            size="icon"
            className="w-9 h-9 min-w-[36px] rounded-full text-slate-400 hover:text-destructive hover:bg-rose-50 border-none cursor-pointer"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label={`Xóa từ ${vocabulary.word}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <ConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title="Xóa từ vựng?"
          description={
            <span>
              Bạn có chắc chắn muốn xóa từ{" "}
              <strong className="font-semibold text-slate-900">
                "{vocabulary.word}"
              </strong>
              ? Hành động này không thể hoàn tác.
            </span>
          }
          confirmText="Xóa từ"
          cancelText="Hủy"
          variant="destructive"
          onConfirm={handleDelete}
        />
      </Card>
    </motion.div>
  );
});
