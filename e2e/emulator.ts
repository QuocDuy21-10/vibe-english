import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const firebaseConfig = JSON.parse(readFileSync(new URL("../firebase-applet-config.json", import.meta.url), "utf8")) as { apiKey: string };

// Seeds the local Firebase emulators used by the E2E suite. Never points at production:
// every URL is 127.0.0.1 and the project id is a demo- id.
export const PROJECT_ID = "demo-vibe-english";
export const DATABASE_ID = "ai-studio-5ce4ff1b-cd4e-4400-b368-cedf76f6e3ea";
export const AUTH_URL = "http://127.0.0.1:9199";
export const FIRESTORE_URL = "http://127.0.0.1:8180";
export const APP_URL = "http://localhost:3100";
export const TEST_USER = { sub: "e2e-google-user", email: "learner@example.test", name: "E2E Learner" };

const DOCS = `${FIRESTORE_URL}/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
const DAY = 86_400_000;

type Value = string | number | boolean | null | Date | Value[] | { [key: string]: Value };

function toFirestoreValue(value: Value): Record<string, unknown> {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  return { mapValue: { fields: toFields(value) } };
}

function toFields(data: { [key: string]: Value }) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)]));
}

async function request(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${init.method} ${url} → ${response.status} ${await response.text()}`);
  return response.json();
}

async function writeDoc(path: string, data: { [key: string]: Value }) {
  await request(`${DOCS}/${path}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFields(data) }),
  });
}

export async function resetEmulators() {
  await request(`${AUTH_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" });
  await request(`${FIRESTORE_URL}/emulator/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`, { method: "DELETE" });
}

export type EmulatorSession = { uid: string; idToken: string; refreshToken: string };

/** Creates (or signs in) the Google account in the Auth emulator. */
export async function createGoogleUser(): Promise<EmulatorSession> {
  const idToken = JSON.stringify({ ...TEST_USER, email_verified: true });
  const result = await request(`${AUTH_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postBody: `id_token=${encodeURIComponent(idToken)}&providerId=google.com`,
      requestUri: "http://localhost",
      returnSecureToken: true,
    }),
  });
  return { uid: result.localId, idToken: result.idToken, refreshToken: result.refreshToken };
}

/**
 * Persists a real emulator session the way the Firebase Web SDK does (IndexedDB), so the app's own
 * onAuthStateChanged + route guards authenticate it. The emulator's Google popup cannot be used because
 * browsers partition its storage from the app's iframe.
 */
export async function persistSession(page: Page, session: EmulatorSession) {
  await page.goto(`${APP_URL}/favicon.svg`);
  const key = `firebase:authUser:${firebaseConfig.apiKey}:[DEFAULT]`;
  const value = {
    uid: session.uid,
    email: TEST_USER.email,
    emailVerified: true,
    displayName: TEST_USER.name,
    isAnonymous: false,
    providerData: [{ providerId: "google.com", uid: TEST_USER.sub, displayName: TEST_USER.name, email: TEST_USER.email, phoneNumber: null, photoURL: null }],
    stsTokenManager: { refreshToken: session.refreshToken, accessToken: session.idToken, expirationTime: Date.now() + 3_000_000 },
    createdAt: String(Date.now()),
    lastLoginAt: String(Date.now()),
    apiKey: firebaseConfig.apiKey,
    appName: "[DEFAULT]",
  };
  await page.evaluate(({ key, value }) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open("firebaseLocalStorageDb", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" });
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction("firebaseLocalStorage", "readwrite");
      tx.objectStore("firebaseLocalStorage").put({ fbase_key: key, value });
      tx.oncomplete = () => { open.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }), { key, value });
}

export const LONG_WORD = "pneumonoultramicroscopicsilicovolcanoconiosis";
export const LONG_TOPIC = "Chủ đề có tên cực kỳ dài để kiểm tra khả năng xuống dòng của giao diện trên điện thoại";

const WORDS: Array<[string, string, string, string]> = [
  [LONG_WORD, "noun", "/ˌnjuːmənəʊˌʌltrəˌmaɪkrəʊˈskɒpɪkˌsɪlɪkəʊvɒlˌkeɪnəʊkəʊniˈəʊsɪs/",
    "Một bệnh phổi do hít phải bụi silica rất mịn, thường gặp ở thợ mỏ và người sống gần núi lửa; định nghĩa này được viết dài để kiểm tra việc xuống dòng."],
  ["serendipity", "noun", "/ˌserənˈdɪpəti/", "Sự tình cờ may mắn"],
  ["ubiquitous", "adjective", "/juːˈbɪkwɪtəs/", "Có mặt ở khắp mọi nơi"],
  ["ephemeral", "adjective", "/ɪˈfemərəl/", "Phù du, chóng tàn"],
  ["resilient", "adjective", "/rɪˈzɪliənt/", "Kiên cường, mau phục hồi"],
  ["meticulous", "adjective", "/məˈtɪkjələs/", "Tỉ mỉ, kỹ lưỡng"],
  ["advocate", "verb", "/ˈædvəkeɪt/", "Ủng hộ, tán thành"],
  ["advocate", "noun", "/ˈædvəkət/", "Người ủng hộ, luật sư"],
  ["benevolent", "adjective", "/bəˈnevələnt/", "Nhân từ, rộng lượng"],
  ["candid", "adjective", "/ˈkændɪd/", "Thẳng thắn, bộc trực"],
  ["diligent", "adjective", "/ˈdɪlɪdʒənt/", "Siêng năng, cần cù"],
  ["eloquent", "adjective", "/ˈeləkwənt/", "Hùng hồn, có tài hùng biện"],
  ["frugal", "adjective", "/ˈfruːɡl/", "Tiết kiệm, đạm bạc"],
  ["gregarious", "adjective", "/ɡrɪˈɡeəriəs/", "Thích giao du, hòa đồng"],
  ["hinder", "verb", "/ˈhɪndə(r)/", "Cản trở"],
  ["immerse", "verb", "/ɪˈmɜːs/", "Đắm chìm, nhúng vào"],
  ["jeopardize", "verb", "/ˈdʒepədaɪz/", "Gây nguy hiểm"],
  ["keen", "adjective", "/kiːn/", "Say mê, sắc sảo"],
  ["leverage", "verb", "/ˈliːvərɪdʒ/", "Tận dụng"],
  ["mitigate", "verb", "/ˈmɪtɪɡeɪt/", "Giảm nhẹ"],
  ["negotiate", "verb", "/nɪˈɡəʊʃieɪt/", "Đàm phán"],
  ["obsolete", "adjective", "/ˈɒbsəliːt/", "Lỗi thời"],
  ["persevere", "verb", "/ˌpɜːsɪˈvɪə(r)/", "Kiên trì"],
  ["quarantine", "noun", "/ˈkwɒrəntiːn/", "Sự cách ly"],
  ["reluctant", "adjective", "/rɪˈlʌktənt/", "Miễn cưỡng"],
  ["scrutinize", "verb", "/ˈskruːtənaɪz/", "Xem xét kỹ lưỡng"],
  ["tenacious", "adjective", "/təˈneɪʃəs/", "Bền bỉ, ngoan cường"],
  ["unanimous", "adjective", "/juˈnænɪməs/", "Nhất trí"],
  ["versatile", "adjective", "/ˈvɜːsətaɪl/", "Đa năng"],
  ["wholesome", "adjective", "/ˈhəʊlsəm/", "Lành mạnh"],
];

/** Seeds a populated account: long names, enough words for pagination, due cards and recent review history. */
export async function seedPopulatedAccount(uid: string) {
  const now = Date.now();
  const topics = [
    ["topic-work", "Công việc"],
    ["topic-daily", "Giao tiếp hằng ngày"],
    ["topic-long", LONG_TOPIC],
  ];
  for (const [id, name] of topics) {
    await writeDoc(`topics/${id}`, { name, userId: uid, createdAt: new Date(now - 30 * DAY) });
  }

  await Promise.all(WORDS.map(([word, partOfSpeech, phonetic, definition], index) =>
    writeDoc(`vocabularies/vocab-${index}`, {
      word,
      normalizedWord: word.toLowerCase(),
      definition,
      partOfSpeech,
      phonetic,
      topicId: topics[index % topics.length][0],
      userId: uid,
      createdAt: new Date(now - (40 - index) * DAY),
      updatedAt: new Date(now - (40 - index) * DAY),
      level: index % 5,
      // Most cards are due so study sessions always have work.
      nextReview: new Date(now + (index % 4 === 0 ? 3 : -1) * DAY),
      srsVersion: 1,
      intervalDays: index % 5,
      easeFactor: 2.5,
      repetitions: index % 3,
      lapses: index % 2,
      lastReviewedAt: index % 3 === 0 ? null : new Date(now - 2 * DAY),
    })
  ));

  const ratings = ["again", "hard", "good", "easy"];
  const events = Array.from({ length: 60 }, (_, index) => index);
  await Promise.all(events.map((index) =>
    writeDoc(`reviewEvents/event-${index}`, {
      userId: uid,
      vocabularyId: `vocab-${index % WORDS.length}`,
      rating: ratings[index % ratings.length],
      previousLevel: 1,
      newLevel: 2,
      previousIntervalDays: 1,
      newIntervalDays: 2,
      reviewedAt: new Date(now - (index % 20) * DAY - 3_600_000),
      topicId: topics[index % topics.length][0],
      srsVersion: 1,
    })
  ));

  await writeDoc(`userSettings/${uid}`, { dailyGoal: 20, updatedAt: new Date(now - DAY) });
}
