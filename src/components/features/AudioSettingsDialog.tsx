import { useMemo, useState } from "react";
import { Loader2, Play, Settings2, Volume2, VolumeX, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import type { EnglishAccent } from "@/lib/audioSettings";
import { getPronunciationNotice, type PronunciationNotice } from "@/lib/audioUi";
import { useAudio } from "@/routes/AudioProvider";

const PREVIEW_TEXT = "Hello! Welcome to your English practice.";

function pronunciationNoticeText(notice: PronunciationNotice, accent: EnglishAccent): string {
  if (notice.type === "unsupported") return "Trình duyệt này không hỗ trợ phát âm bằng Web Speech API.";
  if (notice.type === "loading") return "Đang tải danh sách giọng đọc từ thiết bị…";
  if (notice.type === "no-voices") return "Không lấy được danh sách voice; trình duyệt sẽ tự chọn giọng khi có thể.";
  if (notice.type === "no-exact") return `Không có voice ${accent}; ứng dụng sẽ dùng một voice tiếng Anh khác.`;
  if (notice.type === "no-english") return "Thiết bị không có voice tiếng Anh khả dụng.";
  if (notice.type === "error") return "Không thể phát âm lúc này. Hãy thử lại.";
  if (notice.type === "fallback") return `Đang fallback sang ${notice.locale}.`;
  return "Voice và accent phụ thuộc vào các giọng được cài trên thiết bị.";
}

export function AudioSettingsDialog() {
  const {
    settings,
    voices,
    voiceState,
    pronunciationStatus,
    lastPronunciationResult,
    updateSettings,
    speak
  } = useAudio();
  const [previewPending, setPreviewPending] = useState(false);
  const exactVoices = useMemo(
    () => voices
      .filter((voice) => voice.lang.toLowerCase() === settings.accent.toLowerCase())
      .sort((left, right) => left.name.localeCompare(right.name)),
    [settings.accent, voices]
  );

  const preview = async () => {
    setPreviewPending(true);
    try {
      await speak(PREVIEW_TEXT);
    } finally {
      setPreviewPending(false);
    }
  };

  const pronunciationMessage = pronunciationNoticeText(
    getPronunciationNotice({
      voiceState,
      voiceCount: voices.length,
      exactVoiceCount: exactVoices.length,
      pronunciationStatus,
      result: lastPronunciationResult
    }),
    settings.accent
  );

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-full text-slate-500 hover:bg-[#ECFDF5] hover:text-[#10b981]"
            aria-label="Cài đặt âm thanh"
            title="Cài đặt âm thanh"
          />
        }
      >
        <Settings2 className="h-5 w-5" />
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="overflow-x-hidden overflow-y-auto rounded-3xl border-none p-0 shadow-2xl sm:max-w-lg">
        <DialogHeader className="relative bg-[#10b981] p-5 pr-16 text-white sm:p-6 sm:pr-16">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-white sm:text-2xl">
            <Volume2 className="h-5 w-5" /> Cài đặt âm thanh
          </DialogTitle>
          <DialogDescription className="text-sm text-white/80">
            Điều chỉnh hiệu ứng học tập và giọng phát âm độc lập.
          </DialogDescription>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 h-11 w-11 min-h-[44px] min-w-[44px] rounded-full text-white/80 hover:bg-white/15 hover:text-white"
                aria-label="Đóng cài đặt âm thanh"
              />
            }
          >
            <X className="h-5 w-5" />
          </DialogClose>
        </DialogHeader>

        <div className="space-y-6 bg-white p-5 sm:p-6">
          <section className="space-y-4" aria-labelledby="sfx-settings-title">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 id="sfx-settings-title" className="font-bold text-slate-900">Hiệu ứng học tập</h3>
                <p className="text-xs leading-relaxed text-slate-500">Âm báo đúng, sai, lật thẻ và hoàn thành.</p>
              </div>
              <Button
                type="button"
                role="switch"
                aria-checked={settings.soundEffectsEnabled}
                onClick={() => updateSettings({ soundEffectsEnabled: !settings.soundEffectsEnabled })}
                className={`min-h-11 min-w-[92px] rounded-full border-none font-bold ${
                  settings.soundEffectsEnabled
                    ? "bg-[#10b981] text-white hover:bg-[#10b981]/90"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {settings.soundEffectsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                {settings.soundEffectsEnabled ? "Đang bật" : "Đã tắt"}
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <label htmlFor="sound-effects-volume">Âm lượng hiệu ứng</label>
                <span>{Math.round(settings.soundEffectsVolume * 100)}%</span>
              </div>
              <input
                id="sound-effects-volume"
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round(settings.soundEffectsVolume * 100)}
                disabled={!settings.soundEffectsEnabled}
                onChange={(event) => updateSettings({ soundEffectsVolume: Number(event.target.value) / 100 })}
                className="h-11 w-full cursor-pointer accent-[#10b981] disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </section>

          <section className="space-y-4 border-t border-slate-100 pt-5" aria-labelledby="pronunciation-settings-title">
            <div className="space-y-1">
              <h3 id="pronunciation-settings-title" className="font-bold text-slate-900">Phát âm tiếng Anh</h3>
              <p className="text-xs leading-relaxed text-slate-500">Chọn accent và voice có sẵn trên trình duyệt này.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label id="audio-accent-label" htmlFor="audio-accent" className="text-xs font-semibold text-slate-600">Accent</label>
                <Select
                  value={settings.accent}
                  onValueChange={(value) => value && updateSettings({ accent: value as EnglishAccent })}
                >
                  <SelectTrigger id="audio-accent" aria-labelledby="audio-accent-label" className="h-11 w-full rounded-xl border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem className="min-h-11" value="en-US">Anh–Mỹ (US)</SelectItem>
                    <SelectItem className="min-h-11" value="en-GB">Anh–Anh (UK)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label id="audio-voice-label" htmlFor="audio-voice" className="text-xs font-semibold text-slate-600">Voice</label>
                <Select
                  value={settings.voiceURI ?? "auto"}
                  disabled={voiceState !== "ready" || exactVoices.length < 2}
                  onValueChange={(value) => updateSettings({ voiceURI: !value || value === "auto" ? null : value })}
                >
                  <SelectTrigger id="audio-voice" aria-labelledby="audio-voice-label" className="h-11 w-full rounded-xl border-slate-200">
                    <SelectValue placeholder="Tự động" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem className="min-h-11" value="auto">Tự động (khuyên dùng)</SelectItem>
                    {exactVoices.map((voice) => (
                      <SelectItem className="min-h-11" key={voice.voiceURI} value={voice.voiceURI}>{voice.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-500" role="status">{pronunciationMessage}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void preview()}
              disabled={previewPending || voiceState === "unsupported"}
              className="min-h-11 w-full rounded-full border-emerald-200 bg-[#ECFDF5] font-bold text-[#10b981] hover:bg-emerald-100"
            >
              {previewPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {pronunciationStatus === "speaking" ? "Đang phát âm…" : "Nghe thử"}
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
