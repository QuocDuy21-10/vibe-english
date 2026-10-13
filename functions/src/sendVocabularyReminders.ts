import {
  formatVocabularyNotification,
  isActiveReminderHour,
  isInvalidRegistrationError,
  selectVocabularyForWindow,
  type NotificationVocabulary
} from "./notificationDomain";

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const MAX_MULTICAST_TOKENS = 500;

export interface NotificationDeviceRecord {
  path: string;
  userId: string;
  token: string;
}

export interface DispatchState {
  lastWindowKey: string | null;
  lastVocabularyId: string | null;
}

export interface VocabularyPushMessage {
  tokens: string[];
  data: {
    title: string;
    body: string;
    vocabularyId: string;
    word: string;
    url: string;
  };
}

export interface BatchSendResult {
  responses: Array<{
    success: boolean;
    errorCode?: string;
  }>;
}

export interface DispatchDependencies {
  listDevices(): Promise<NotificationDeviceRecord[]>;
  listVocabularies(userId: string): Promise<NotificationVocabulary[]>;
  getDispatchState(userId: string): Promise<DispatchState>;
  claimWindow(
    userId: string,
    windowKey: string,
    vocabularyId: string,
    now: Date
  ): Promise<boolean>;
  sendBatch(message: VocabularyPushMessage): Promise<BatchSendResult>;
  deleteDevice(path: string): Promise<void>;
  logError(context: string, errorCode?: string): void;
}

export interface DispatchSummary {
  usersConsidered: number;
  usersSent: number;
  devicesSent: number;
  devicesRemoved: number;
}

function getReminderWindowKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}-${value("hour")}`;
}

function groupDevicesByUser(devices: NotificationDeviceRecord[]) {
  const grouped = new Map<string, NotificationDeviceRecord[]>();
  for (const device of devices) {
    const existing = grouped.get(device.userId) ?? [];
    existing.push(device);
    grouped.set(device.userId, existing);
  }
  return grouped;
}

export async function runVocabularyReminderDispatch(
  dependencies: DispatchDependencies,
  now: Date
): Promise<DispatchSummary> {
  const summary: DispatchSummary = {
    usersConsidered: 0,
    usersSent: 0,
    devicesSent: 0,
    devicesRemoved: 0
  };
  if (!isActiveReminderHour(now, TIME_ZONE)) return summary;

  const devicesByUser = groupDevicesByUser(await dependencies.listDevices());
  summary.usersConsidered = devicesByUser.size;
  const windowKey = getReminderWindowKey(now);

  for (const [userId, devices] of devicesByUser) {
    const vocabularies = await dependencies.listVocabularies(userId);
    if (vocabularies.length === 0) continue;

    const state = await dependencies.getDispatchState(userId);
    const vocabulary = selectVocabularyForWindow(
      vocabularies,
      userId,
      windowKey,
      state.lastVocabularyId
    );
    if (!vocabulary) continue;

    const claimed = await dependencies.claimWindow(userId, windowKey, vocabulary.id, now);
    if (!claimed) continue;

    const content = formatVocabularyNotification(vocabulary);
    let sentForUser = false;

    for (let start = 0; start < devices.length; start += MAX_MULTICAST_TOKENS) {
      const batch = devices.slice(start, start + MAX_MULTICAST_TOKENS);
      const result = await dependencies.sendBatch({
        tokens: batch.map((device) => device.token),
        data: {
          title: content.title,
          body: content.body,
          vocabularyId: vocabulary.id,
          word: vocabulary.word.trim(),
          url: "/dictionary"
        }
      });
      sentForUser = true;

      for (let index = 0; index < result.responses.length; index += 1) {
        const response = result.responses[index];
        if (response.success) {
          summary.devicesSent += 1;
          continue;
        }

        const device = batch[index];
        if (device && isInvalidRegistrationError(response.errorCode)) {
          await dependencies.deleteDevice(device.path);
          summary.devicesRemoved += 1;
        } else {
          dependencies.logError("vocabulary reminder send failed", response.errorCode);
        }
      }
    }

    if (sentForUser) summary.usersSent += 1;
  }

  return summary;
}
