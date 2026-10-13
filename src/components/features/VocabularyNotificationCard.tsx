import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  disableVocabularyNotifications,
  enableVocabularyNotifications,
  getCurrentDeviceSubscription,
  type DeviceSubscriptionState
} from "@/services/notificationService";

type VocabularyNotificationCardProps = {
  userId: string;
  vocabularyCount: number;
};

function isIosWithoutInstalledPwa(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || iosNavigator.standalone === true;
  return isIos && !isStandalone;
}

export function VocabularyNotificationCard({
  userId,
  vocabularyCount
}: VocabularyNotificationCardProps) {
  const [subscription, setSubscription] = useState<DeviceSubscriptionState | null>(null);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSubscription(null);
    setErrorMessage(null);

    getCurrentDeviceSubscription(userId)
      .then((state) => {
        if (active) setSubscription(state);
      })
      .catch((error) => {
        console.error("Unable to read notification subscription state", error);
        if (active) setErrorMessage("Không thể kiểm tra trạng thái thông báo lúc này.");
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const handleEnable = async () => {
    setPending(true);
    setErrorMessage(null);
    try {
      await enableVocabularyNotifications(userId);
      setSubscription({ capability: "granted", subscribed: true });
      toast.success("Đã bật nhắc từ vựng trên thiết bị này.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể bật thông báo.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  };

  const handleDisable = async () => {
    setPending(true);
    setErrorMessage(null);
    try {
      await disableVocabularyNotifications(userId);
      setSubscription((current) => ({
        capability: current?.capability ?? "granted",
        subscribed: false
      }));
      toast.info("Đã tắt nhắc từ vựng trên thiết bị này.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể tắt thông báo.";
      setErrorMessage(message);
      toast.error("Không thể tắt thông báo. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  };

  const isLoading = !subscription && !errorMessage;
  const isUnsupported = subscription?.capability === "unsupported";
  const isDenied = subscription?.capability === "denied";
  const isSubscribed = subscription?.subscribed === true;
  const needsVocabulary = vocabularyCount === 0 && !isSubscribed;

  return (
    <Card className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:rounded-3xl sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#ECFDF5] text-[#10b981]">
            {isSubscribed ? <Bell className="h-6 w-6" /> : <BellOff className="h-6 w-6" />}
          </div>
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#10b981]">Nhắc từ vựng</p>
            <h2 className="text-lg font-black tracking-tight text-slate-900 sm:text-xl">
              Một từ mới mỗi khoảng 2 giờ
            </h2>
            <p className="max-w-prose text-sm leading-relaxed text-slate-600">
              Nhận một từ bất kỳ lúc 08:00–20:00 hằng ngày, gồm từ, phiên âm, loại từ và nghĩa ngắn gọn.
            </p>
            <p className="flex max-w-prose items-start gap-1.5 text-xs leading-relaxed text-slate-500">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              Nội dung từ vựng có thể xuất hiện trên màn hình khóa. Đăng xuất sẽ tự tắt thông báo trên thiết bị này.
            </p>
            {needsVocabulary && (
              <p className="text-sm font-medium text-amber-700">Hãy thêm ít nhất một từ vựng trước khi bật.</p>
            )}
            {isUnsupported && (
              <p className="text-sm font-medium text-amber-700">
                {isIosWithoutInstalledPwa()
                  ? "Trên iPhone/iPad, hãy thêm Vocabloom vào Màn hình chính rồi mở ứng dụng từ đó."
                  : "Trình duyệt này chưa hỗ trợ thông báo đẩy cho Vocabloom."}
              </p>
            )}
            {isDenied && (
              <p className="text-sm font-medium text-amber-700">
                Quyền thông báo đang bị chặn. Hãy bật lại trong cài đặt trang web của trình duyệt.
              </p>
            )}
            {errorMessage && <p className="text-sm font-medium text-rose-600">{errorMessage}</p>}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {isLoading ? (
            <div className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-500" role="status">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang kiểm tra
            </div>
          ) : isSubscribed ? (
            <>
              <div className="flex min-h-11 items-center gap-2 rounded-full bg-emerald-50 px-4 text-sm font-bold text-emerald-700">
                <Bell className="h-4 w-4" /> Đang bật trên thiết bị này
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full px-4 sm:w-auto"
                disabled={pending}
                onClick={handleDisable}
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Tắt thông báo
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="min-h-11 w-full px-5 sm:w-auto"
              disabled={pending || needsVocabulary || isUnsupported || isDenied}
              onClick={handleEnable}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              Bật nhắc từ vựng
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
