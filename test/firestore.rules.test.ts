import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
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

  describe("notification device rules", () => {
    const validDevice = {
      userId: "alice",
      token: "fcm-token-alice",
      platform: "Mozilla/5.0 Test Browser",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    it("allows an owner to create, read, list, update, and delete a device", async () => {
      const aliceDb = testEnv.authenticatedContext("alice").firestore();
      const deviceRef = doc(aliceDb, "notificationUsers/alice/devices/install-a");

      await assertSucceeds(setDoc(deviceRef, validDevice));
      await assertSucceeds(getDoc(deviceRef));
      await assertSucceeds(getDocs(collection(aliceDb, "notificationUsers/alice/devices")));
      await assertSucceeds(updateDoc(deviceRef, {
        token: "refreshed-token",
        platform: "Mozilla/5.0 Updated Browser",
        updatedAt: serverTimestamp()
      }));
      await assertSucceeds(deleteDoc(deviceRef));
    });

    it("denies anonymous and cross-user access to device registrations", async () => {
      await seedDocument("notificationUsers/alice/devices/install-a", {
        userId: "alice",
        token: "fcm-token-alice",
        platform: "Mozilla/5.0 Test Browser",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      const anonymousDb = testEnv.unauthenticatedContext().firestore();
      const bobDb = testEnv.authenticatedContext("bob").firestore();

      await assertFails(getDoc(doc(anonymousDb, "notificationUsers/alice/devices/install-a")));
      await assertFails(setDoc(doc(anonymousDb, "notificationUsers/alice/devices/install-b"), validDevice));
      await assertFails(getDoc(doc(bobDb, "notificationUsers/alice/devices/install-a")));
      await assertFails(getDocs(collection(bobDb, "notificationUsers/alice/devices")));
      await assertFails(updateDoc(doc(bobDb, "notificationUsers/alice/devices/install-a"), {
        token: "stolen-token",
        updatedAt: serverTimestamp()
      }));
      await assertFails(deleteDoc(doc(bobDb, "notificationUsers/alice/devices/install-a")));
    });

    it("denies device documents with missing, unknown, or oversized fields", async () => {
      const aliceDb = testEnv.authenticatedContext("alice").firestore();

      await assertFails(setDoc(doc(aliceDb, "notificationUsers/alice/devices/missing"), {
        userId: "alice",
        token: "token",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }));
      await assertFails(setDoc(doc(aliceDb, "notificationUsers/alice/devices/unknown"), {
        ...validDevice,
        secret: "unexpected"
      }));
      await assertFails(setDoc(doc(aliceDb, "notificationUsers/alice/devices/long-token"), {
        ...validDevice,
        token: "t".repeat(4097)
      }));
      await assertFails(setDoc(doc(aliceDb, "notificationUsers/alice/devices/long-platform"), {
        ...validDevice,
        platform: "p".repeat(301)
      }));
    });

    it("denies mismatched ownership, client timestamps, and immutable-field updates", async () => {
      const aliceDb = testEnv.authenticatedContext("alice").firestore();
      const now = Timestamp.now();

      await assertFails(setDoc(doc(aliceDb, "notificationUsers/alice/devices/wrong-owner"), {
        ...validDevice,
        userId: "bob"
      }));
      await assertFails(setDoc(doc(aliceDb, "notificationUsers/alice/devices/client-time"), {
        ...validDevice,
        createdAt: now,
        updatedAt: now
      }));

      await seedDocument("notificationUsers/alice/devices/install-a", {
        userId: "alice",
        token: "fcm-token-alice",
        platform: "Mozilla/5.0 Test Browser",
        createdAt: now,
        updatedAt: now
      });

      const deviceRef = doc(aliceDb, "notificationUsers/alice/devices/install-a");
      await assertFails(updateDoc(deviceRef, {
        userId: "bob",
        updatedAt: serverTimestamp()
      }));
      await assertFails(updateDoc(deviceRef, {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }));
      await assertFails(updateDoc(deviceRef, {
        token: "new-token",
        updatedAt: now
      }));
    });

    it("denies every client operation on notification dispatch state", async () => {
      await seedDocument("notificationDispatchStates/alice", {
        lastWindowKey: "2026-10-13T08",
        lastVocabularyId: "vocab-1",
        lastSentAt: Timestamp.now()
      });

      const aliceDb = testEnv.authenticatedContext("alice").firestore();
      const stateRef = doc(aliceDb, "notificationDispatchStates/alice");

      await assertFails(getDoc(stateRef));
      await assertFails(getDocs(collection(aliceDb, "notificationDispatchStates")));
      await assertFails(setDoc(doc(aliceDb, "notificationDispatchStates/new-state"), {
        lastWindowKey: "2026-10-13T10",
        lastVocabularyId: null,
        lastSentAt: serverTimestamp()
      }));
      await assertFails(updateDoc(stateRef, { lastVocabularyId: "vocab-2" }));
      await assertFails(deleteDoc(stateRef));
    });

    it("allows an owner to delete an already-missing device registration", async () => {
      const aliceDb = testEnv.authenticatedContext("alice").firestore();

      await assertSucceeds(
        deleteDoc(doc(aliceDb, "notificationUsers/alice/devices/already-removed"))
      );
    });
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
  it("allows user to create a valid SRS vocabulary with all 17 required fields", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, "vocabularies/v1"), {
        word: "serendipity",
        normalizedWord: "serendipity",
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

  it("allows synonym lists on vocabulary create and update", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const vocabularyRef = doc(aliceDb, "vocabularies/v_synonyms");

    await assertSucceeds(
      setDoc(vocabularyRef, {
        word: "happy",
        normalizedWord: "happy",
        definition: "vui vẻ",
        partOfSpeech: "adjective",
        phonetic: "/ˈhæp.i/",
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
        lastReviewedAt: null,
        synonymIds: { v2: true },
        customSynonyms: { cheerful: true }
      })
    );

    await assertSucceeds(
      updateDoc(vocabularyRef, {
        synonymIds: { v2: true, v3: true },
        customSynonyms: { cheerful: true, glad: true },
        updatedAt: serverTimestamp()
      })
    );

    await assertSucceeds(
      updateDoc(vocabularyRef, {
        synonymIds: Object.fromEntries(
          Array.from({ length: 5 }, (_, index) => [`linked-${index}`, true])
        ),
        customSynonyms: Object.fromEntries(
          Array.from({ length: 5 }, (_, index) => [`custom-${index}`, true])
        ),
        updatedAt: serverTimestamp()
      })
    );
  });

  it("denies synonym fields with invalid persisted types", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();

    await assertFails(
      setDoc(doc(aliceDb, "vocabularies/v_invalid_synonyms"), {
        word: "happy",
        normalizedWord: "happy",
        definition: "vui vẻ",
        partOfSpeech: "adjective",
        phonetic: "/ˈhæp.i/",
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
        lastReviewedAt: null,
        synonymIds: "v2",
        customSynonyms: { cheerful: true }
      })
    );

    await assertFails(
      setDoc(doc(aliceDb, "vocabularies/v_invalid_synonym_items"), {
        word: "happy",
        normalizedWord: "happy",
        definition: "vui vẻ",
        partOfSpeech: "adjective",
        phonetic: "/ˈhæp.i/",
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
        lastReviewedAt: null,
        synonymIds: ["v2"],
        customSynonyms: ["cheerful"]
      })
    );

    await assertFails(
      setDoc(doc(aliceDb, "vocabularies/v_too_many_synonyms"), {
        word: "happy",
        normalizedWord: "happy",
        definition: "vui vẻ",
        partOfSpeech: "adjective",
        phonetic: "/ˈhæp.i/",
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
        lastReviewedAt: null,
        synonymIds: {},
        customSynonyms: Object.fromEntries(
          Array.from({ length: 11 }, (_, index) => [`synonym-${index}`, true])
        )
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
      normalizedWord: "apple",
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

  it("allows reviews to preserve legacy array synonyms but denies changing them as arrays", async () => {
    const now = Timestamp.now();
    await seedDocument("vocabularies/v_legacy_synonyms", {
      word: "happy",
      normalizedWord: "happy",
      definition: "vui vẻ",
      partOfSpeech: "adjective",
      phonetic: "/ˈhæp.i/",
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
      lastReviewedAt: null,
      synonymIds: ["v2"],
      customSynonyms: ["cheerful"]
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const vocabularyRef = doc(aliceDb, "vocabularies/v_legacy_synonyms");

    await assertSucceeds(
      updateDoc(vocabularyRef, {
        level: 1,
        intervalDays: 1,
        repetitions: 1,
        lastReviewedAt: serverTimestamp(),
        nextReview: Timestamp.fromDate(new Date(Date.now() + 86400000)),
        updatedAt: serverTimestamp()
      })
    );

    await assertFails(
      updateDoc(vocabularyRef, {
        customSynonyms: ["cheerful", "glad"],
        updatedAt: serverTimestamp()
      })
    );
  });

  // 9. ReviewEvents security rules
  describe("reviewEvents collection rules", () => {
    it("denies unauthenticated users from creating reviewEvents", async () => {
      const anonDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(
        setDoc(doc(anonDb, "reviewEvents/e1"), {
          userId: "anon",
          vocabularyId: "v1",
          rating: "good",
          previousLevel: 0,
          newLevel: 1,
          previousIntervalDays: 0,
          newIntervalDays: 1,
          topicId: null,
          srsVersion: 1,
          reviewedAt: serverTimestamp()
        })
      );
    });

    it("allows authenticated user to create own valid reviewEvent", async () => {
      const aliceDb = testEnv.authenticatedContext("alice").firestore();
      await assertSucceeds(
        setDoc(doc(aliceDb, "reviewEvents/e_alice"), {
          userId: "alice",
          vocabularyId: "v1",
          rating: "good",
          previousLevel: 0,
          newLevel: 1,
          previousIntervalDays: 0,
          newIntervalDays: 1,
          topicId: null,
          srsVersion: 1,
          reviewedAt: serverTimestamp()
        })
      );
    });

    it("denies user A from creating reviewEvent for user B", async () => {
      const aliceDb = testEnv.authenticatedContext("alice").firestore();
      await assertFails(
        setDoc(doc(aliceDb, "reviewEvents/e_bob"), {
          userId: "bob",
          vocabularyId: "v1",
          rating: "good",
          previousLevel: 0,
          newLevel: 1,
          previousIntervalDays: 0,
          newIntervalDays: 1,
          topicId: null,
          srsVersion: 1,
          reviewedAt: serverTimestamp()
        })
      );
    });

    it("denies user A from reading user B reviewEvent", async () => {
      await seedDocument("reviewEvents/e_bob", {
        userId: "bob",
        vocabularyId: "v_bob",
        rating: "good",
        previousLevel: 0,
        newLevel: 1,
        previousIntervalDays: 0,
        newIntervalDays: 1,
        topicId: null,
        srsVersion: 1,
        reviewedAt: Timestamp.now()
      });

      const aliceDb = testEnv.authenticatedContext("alice").firestore();
      await assertFails(getDoc(doc(aliceDb, "reviewEvents/e_bob")));
    });

    it("allows user A to read own reviewEvent", async () => {
      await seedDocument("reviewEvents/e_alice", {
        userId: "alice",
        vocabularyId: "v_alice",
        rating: "good",
        previousLevel: 0,
        newLevel: 1,
        previousIntervalDays: 0,
        newIntervalDays: 1,
        topicId: null,
        srsVersion: 1,
        reviewedAt: Timestamp.now()
      });

      const aliceDb = testEnv.authenticatedContext("alice").firestore();
      await assertSucceeds(getDoc(doc(aliceDb, "reviewEvents/e_alice")));
    });

    it("denies updating reviewEvent", async () => {
      await seedDocument("reviewEvents/e_alice", {
        userId: "alice",
        vocabularyId: "v_alice",
        rating: "good",
        previousLevel: 0,
        newLevel: 1,
        previousIntervalDays: 0,
        newIntervalDays: 1,
        topicId: null,
        srsVersion: 1,
        reviewedAt: Timestamp.now()
      });

      const aliceDb = testEnv.authenticatedContext("alice").firestore();
      await assertFails(
        updateDoc(doc(aliceDb, "reviewEvents/e_alice"), {
          rating: "again"
        })
      );
    });

    it("denies deleting reviewEvent", async () => {
      await seedDocument("reviewEvents/e_alice", {
        userId: "alice",
        vocabularyId: "v_alice",
        rating: "good",
        previousLevel: 0,
        newLevel: 1,
        previousIntervalDays: 0,
        newIntervalDays: 1,
        topicId: null,
        srsVersion: 1,
        reviewedAt: Timestamp.now()
      });

      const aliceDb = testEnv.authenticatedContext("alice").firestore();
      const { deleteDoc: firestoreDelete } = await import("firebase/firestore");
      await assertFails(firestoreDelete(doc(aliceDb, "reviewEvents/e_alice")));
    });

    it("denies reviewEvent with invalid rating", async () => {
      const aliceDb = testEnv.authenticatedContext("alice").firestore();
      await assertFails(
        setDoc(doc(aliceDb, "reviewEvents/e_invalid_rating"), {
          userId: "alice",
          vocabularyId: "v1",
          rating: "invalid_rating",
          previousLevel: 0,
          newLevel: 1,
          previousIntervalDays: 0,
          newIntervalDays: 1,
          topicId: null,
          srsVersion: 1,
          reviewedAt: serverTimestamp()
        })
      );
    });

    it("denies reviewEvent with negative interval", async () => {
      const aliceDb = testEnv.authenticatedContext("alice").firestore();
      await assertFails(
        setDoc(doc(aliceDb, "reviewEvents/e_neg_interval"), {
          userId: "alice",
          vocabularyId: "v1",
          rating: "good",
          previousLevel: 0,
          newLevel: 1,
          previousIntervalDays: 0,
          newIntervalDays: -5,
          topicId: null,
          srsVersion: 1,
          reviewedAt: serverTimestamp()
        })
      );
    });
  });
});
