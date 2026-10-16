import { randomUUID } from "node:crypto";
import { createFirebaseAdminDispatchDependencies } from "./firebaseAdminAdapter";
import {
  resolveDispatchWindow,
  type DispatchMode,
  type DispatchSource
} from "./notificationDomain";
import {
  runVocabularyReminderDispatch,
  type DispatchSummary
} from "./sendVocabularyReminders";

function readMode(value: string | undefined): DispatchMode {
  if (value === "dry-run" || value === "live") return value;
  throw new Error("DISPATCH_MODE must be dry-run or live");
}

function readSource(value: string | undefined): DispatchSource {
  if (value === "schedule" || value === "manual") return value;
  throw new Error("DISPATCH_SOURCE must be schedule or manual");
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function getDispatchExitCode(summary: DispatchSummary): number {
  return summary.retryableFailures > 0 || summary.failedDeviceSends > 0 ? 1 : 0;
}

export async function runCli(executedAt = new Date()): Promise<number> {
  const source = readSource(process.env.DISPATCH_SOURCE);
  const mode = readMode(process.env.DISPATCH_MODE);
  const resolution = resolveDispatchWindow({
    source,
    mode,
    executedAt,
    eventSchedule: process.env.GITHUB_EVENT_SCHEDULE,
    manualScheduledAt: process.env.DISPATCH_SCHEDULED_AT,
    confirmLive: process.env.DISPATCH_CONFIRM_LIVE === "true"
  });

  if (resolution.action !== "dispatch" || !resolution.scheduledAt || !resolution.windowKey) {
    console.log(JSON.stringify({
      event: "vocabulary-reminder-window",
      action: resolution.action,
      reason: resolution.reason ?? "unknown",
      scheduledAt: resolution.scheduledAt?.toISOString() ?? null,
      executedAt: resolution.executedAt.toISOString(),
      windowKey: resolution.windowKey
    }));
    return resolution.action === "reject" ? 2 : 0;
  }

  const dependencies = createFirebaseAdminDispatchDependencies({
    projectId: requiredEnvironment("FIREBASE_PROJECT_ID"),
    databaseId: requiredEnvironment("FIRESTORE_DATABASE_ID")
  });
  const summary = await runVocabularyReminderDispatch(dependencies, {
    mode,
    source,
    scheduledAt: resolution.scheduledAt,
    executedAt,
    windowKey: resolution.windowKey,
    runId: process.env.DISPATCH_RUN_ID?.trim() || randomUUID()
  });
  console.log(JSON.stringify({ event: "vocabulary-reminder-summary", mode, source, ...summary }));
  return getDispatchExitCode(summary);
}

if (require.main === module) {
  runCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(JSON.stringify({
        event: "vocabulary-reminder-fatal",
        error: error instanceof Error ? error.message : "Unknown error"
      }));
      process.exitCode = 1;
    });
}
