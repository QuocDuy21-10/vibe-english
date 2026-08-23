import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { describe, beforeAll, afterAll, beforeEach, it, expect } from "vitest";

const PROJECT_ID = "vibe-english-test";
let testEnv: RulesTestEnvironment;

describe("Firestore Security Rules Tests", () => {
  beforeAll(async () => {
    const rules = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: "127.0.0.1",
        port: 8080
      }
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  // --- Helper to seed data without security rule constraints ---
  async function seedDocument(path: string, data: Record<string, any>) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), path), data);
    });
  }

  // 1. Connection test path
  it("allows reading /test/connection for any client", async () => {
    await seedDocument("test/connection", { status: "ok" });
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anonDb, "test/connection")));
  });

  // 2. Anonymous access restrictions
  it("denies unauthenticated users from creating topics", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(anonDb, "topics/topic1"), {
        name: "IELTS",
        userId: "anon",
        createdAt: serverTimestamp()
      })
    );
  });

  it("denies unauthenticated users from creating vocabularies", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(anonDb, "vocabularies/v1"), {
        word: "hello",
        definition: "xin chào",
        partOfSpeech: "noun",
        phonetic: "/həˈloʊ/",
        topicId: null,
        userId: "anon",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        level: 0,
        nextReview: serverTimestamp(),
        srsVersion: 1,
        intervalDays: 0,
        easeFactor: 2.5,
        repetitions: 0,
        lapses: 0,
        lastReviewedAt: null
      })
    );
  });

  // 3. User isolation for reading
  it("allows user A to read user A topic and vocabulary", async () => {
    await seedDocument("topics/t_alice", {
      name: "Alice Topic",
      userId: "alice",
      createdAt: Timestamp.now()
    });
    await seedDocument("vocabularies/v_alice", {
      word: "apple",
      definition: "quả táo",
      partOfSpeech: "noun",
      phonetic: "/ˈæp.əl/",
      topicId: null,
      userId: "alice",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      level: 0,
      nextReview: Timestamp.now()
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(aliceDb, "topics/t_alice")));
    await assertSucceeds(getDoc(doc(aliceDb, "vocabularies/v_alice")));
  });

  it("denies user A from reading user B topic and vocabulary", async () => {
    await seedDocument("topics/t_bob", {
      name: "Bob Topic",
      userId: "bob",
      createdAt: Timestamp.now()
    });
    await seedDocument("vocabularies/v_bob", {
      word: "banana",
      definition: "quả chuối",
      partOfSpeech: "noun",
      phonetic: "/bəˈnæn.ə/",
      topicId: null,
      userId: "bob",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      level: 0,
      nextReview: Timestamp.now()
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(getDoc(doc(aliceDb, "topics/t_bob")));
    await assertFails(getDoc(doc(aliceDb, "vocabularies/v_bob")));
  });

  // 4. User isolation for updates
  it("denies user A from updating user B topic and vocabulary", async () => {
    const now = Timestamp.now();
    await seedDocument("topics/t_bob", {
      name: "Bob Topic",
      userId: "bob",
      createdAt: now
    });
    await seedDocument("vocabularies/v_bob", {
      word: "banana",
      definition: "quả chuối",
      partOfSpeech: "noun",
      phonetic: "/bəˈnæn.ə/",
      topicId: null,
      userId: "bob",
      createdAt: now,
      updatedAt: now,
      level: 0,
      nextReview: now,
      srsVersion: 1,
      intervalDays: 0,
      easeFactor: 2.5,
      repetitions: 0,
      lapses: 0,
      lastReviewedAt: null
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      updateDoc(doc(aliceDb, "topics/t_bob"), {
        name: "Hacked Topic"
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, "vocabularies/v_bob"), {
        definition: "hacked",
        updatedAt: serverTimestamp()
      })
    );
  });

  // 5. Immutability of userId and createdAt
  it("denies modifying userId or createdAt on topics", async () => {
    const now = Timestamp.now();
    await seedDocument("topics/t_alice", {
      name: "Alice Topic",
      userId: "alice",
      createdAt: now
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    // Attempt to change userId
    await assertFails(
      updateDoc(doc(aliceDb, "topics/t_alice"), {
        userId: "bob"
      })
    );
    // Attempt to change createdAt
    await assertFails(
      updateDoc(doc(aliceDb, "topics/t_alice"), {
        createdAt: serverTimestamp()
      })
    );
  });

  it("denies modifying userId or createdAt on vocabularies", async () => {
    const now = Timestamp.now();
    await seedDocument("vocabularies/v_alice", {
      word: "apple",
      definition: "quả táo",
      partOfSpeech: "noun",
      phonetic: "/ˈæp.əl/",
      topicId: null,
      userId: "alice",
      createdAt: now,
      updatedAt: now,
      level: 0,
      nextReview: now,
      srsVersion: 1,
      intervalDays: 0,
      easeFactor: 2.5,
      repetitions: 0,
      lapses: 0,
      lastReviewedAt: null
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    // Attempt to change userId
    await assertFails(
      updateDoc(doc(aliceDb, "vocabularies/v_alice"), {
        userId: "bob",
        updatedAt: serverTimestamp()
      })
    );
    // Attempt to change createdAt
    await assertFails(
      updateDoc(doc(aliceDb, "vocabularies/v_alice"), {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    );
  });

  // 6. Topic create and update rules
  it("allows user to create a valid topic", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, "topics/t1"), {
        name: "Travel",
        userId: "alice",
        createdAt: serverTimestamp()
      })
    );
  });

  it("allows user to update topic name only", async () => {
    const now = Timestamp.now();
    await seedDocument("topics/t1", {
      name: "Travel",
      userId: "alice",
      createdAt: now
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      updateDoc(doc(aliceDb, "topics/t1"), {
        name: "Travel & Vacations"
      })
    );
  });

  // 7. Valid and invalid vocabulary creation
  it("allows user to create a valid SRS vocabulary with all 16 required fields", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, "vocabularies/v1"), {
        word: "serendipity",
        definition: "sự may mắn tình cờ",
        partOfSpeech: "noun",
        phonetic: "/ˌser.ənˈdɪp.ə.t̬i/",
        topicId: null,
        userId: "alice",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        level: 0,
        nextReview: serverTimestamp(),
        srsVersion: 1,
        intervalDays: 0,
        easeFactor: 2.5,
        repetitions: 0,
        lapses: 0,
        lastReviewedAt: null
      })
    );
  });

  it("denies creating vocabulary with invalid easeFactor (< 1.3 or > 3.0)", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    // easeFactor too low
    await assertFails(
      setDoc(doc(aliceDb, "vocabularies/v_low_ease"), {
        word: "test",
        definition: "kiểm tra",
        partOfSpeech: "noun",
        phonetic: "/test/",
        topicId: null,
        userId: "alice",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        level: 0,
        nextReview: serverTimestamp(),
        srsVersion: 1,
        intervalDays: 0,
        easeFactor: 1.2,
        repetitions: 0,
        lapses: 0,
        lastReviewedAt: null
      })
    );
    // easeFactor too high
    await assertFails(
      setDoc(doc(aliceDb, "vocabularies/v_high_ease"), {
        word: "test",
        definition: "kiểm tra",
        partOfSpeech: "noun",
        phonetic: "/test/",
        topicId: null,
        userId: "alice",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        level: 0,
        nextReview: serverTimestamp(),
        srsVersion: 1,
        intervalDays: 0,
        easeFactor: 3.5,
        repetitions: 0,
        lapses: 0,
        lastReviewedAt: null
      })
    );
  });

  it("denies creating vocabulary with invalid level (< 0 or > 4)", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(aliceDb, "vocabularies/v_invalid_level"), {
        word: "test",
        definition: "kiểm tra",
        partOfSpeech: "noun",
        phonetic: "/test/",
        topicId: null,
        userId: "alice",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        level: 5, // SRS max level is 4
        nextReview: serverTimestamp(),
        srsVersion: 1,
        intervalDays: 0,
        easeFactor: 2.5,
        repetitions: 0,
        lapses: 0,
        lastReviewedAt: null
      })
    );
  });

  it("denies creating vocabulary with negative intervalDays", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(aliceDb, "vocabularies/v_neg_interval"), {
        word: "test",
        definition: "kiểm tra",
        partOfSpeech: "noun",
        phonetic: "/test/",
        topicId: null,
        userId: "alice",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        level: 0,
        nextReview: serverTimestamp(),
        srsVersion: 1,
        intervalDays: -1,
        easeFactor: 2.5,
        repetitions: 0,
        lapses: 0,
        lastReviewedAt: null
      })
    );
  });

  it("denies creating vocabulary with missing SRS fields", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(aliceDb, "vocabularies/v_missing_fields"), {
        word: "test",
        definition: "kiểm tra",
        partOfSpeech: "noun",
        phonetic: "/test/",
        topicId: null,
        userId: "alice",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        level: 0,
        nextReview: serverTimestamp()
        // Missing srsVersion, intervalDays, easeFactor, repetitions, lapses, lastReviewedAt
      })
    );
  });

  // 8. Valid SRS review update
  it("allows user to update their vocabulary during SRS review", async () => {
    const now = Timestamp.now();
    await seedDocument("vocabularies/v_review", {
      word: "apple",
      definition: "quả táo",
      partOfSpeech: "noun",
      phonetic: "/ˈæp.əl/",
      topicId: null,
      userId: "alice",
      createdAt: now,
      updatedAt: now,
      level: 0,
      nextReview: now,
      srsVersion: 1,
      intervalDays: 0,
      easeFactor: 2.5,
      repetitions: 0,
      lapses: 0,
      lastReviewedAt: null
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      updateDoc(doc(aliceDb, "vocabularies/v_review"), {
        level: 1,
        intervalDays: 1,
        repetitions: 1,
        easeFactor: 2.5,
        lastReviewedAt: serverTimestamp(),
        nextReview: Timestamp.fromDate(new Date(Date.now() + 86400000)),
        updatedAt: serverTimestamp()
      })
    );
  });
});
