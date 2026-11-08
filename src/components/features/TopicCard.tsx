import { memo } from "react";
import { Edit3, Trash2 } from "lucide-react";

import { TopicDialog } from "@/components/features/TopicDialog";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import type { Topic } from "@/types/types";

type TopicCardProps = {
  topic: Topic;
  vocabularyCount: number;
  userId: string;
  onDelete: (topic: Topic) => void;
};

export const TopicCard = memo(function TopicCard({
  topic,
  vocabularyCount,
  userId,
  onDelete
}: TopicCardProps) {
  return (
    <Card className="rounded-2xl sm:rounded-3xl border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-[#10b981]/40 transition-all group overflow-hidden relative flex flex-col justify-between">
      <div className="absolute top-0 right-0 w-24 h-24 bg-[#ECFDF5] rounded-full -mr-8 -mt-8 opacity-60 group-hover:bg-[#ECFDF5]/90 transition-colors pointer-events-none" />
      <CardHeader className="pb-2 relative">
        <CardTitle className="text-xl font-bold text-slate-800 tracking-tight break-words line-clamp-2">
          {topic.name}
        </CardTitle>
        <CardDescription className="text-xs font-bold text-[#10b981] uppercase tracking-wider mt-1">
          {vocabularyCount} TỪ VỰNG
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex justify-end gap-1.5 pt-2 pb-3 px-4 relative border-t-0 bg-transparent">
        <Dialog>
          <DialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-[#10b981] hover:bg-[#ECFDF5] w-11 h-11 min-w-[44px] rounded-full cursor-pointer border-none"
                aria-label={`Chỉnh sửa chủ đề ${topic.name}`}
              />
            }
          >
            <Edit3 className="w-4 h-4" />
          </DialogTrigger>
          <TopicDialog topic={topic} userId={userId} />
        </Dialog>

        <Button
          variant="ghost"
          size="icon"
          className="text-slate-400 hover:text-destructive hover:bg-rose-50 w-11 h-11 min-w-[44px] rounded-full cursor-pointer border-none"
          aria-label={`Xóa chủ đề ${topic.name}`}
          onClick={() => onDelete(topic)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
});
