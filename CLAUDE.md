# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

The repository rules in `AGENTS.md` (imported above) apply in full. Commit messages follow `.claude/rules/git-workflow.md` (Conventional Commits). This file only adds what `AGENTS.md` is missing and corrects the parts where it no longer matches the source. **Where the two disagree, this file reflects the current code.**

## Commands

```bash
npm run dev                         # Vite on :3000; also serves /api/ai/* locally (see below)
npm run lint                        # tsc --noEmit (type check only, no ESLint)
npm test                            # Vitest, excludes test/firestore.rules.test.ts
npm run test:rules                  # Firestore rules tests in the emulator (port 8080, needs firebase-tools + Java)
npm run test:all                    # npm test && npm run test:rules
npm run build
npm run fb                          # Deploy firestore.rules. REQUIRED after every rules change

npx vitest run src/lib/srs.test.ts            # single file
npx vitest run src/lib/srs.test.ts -t "Easy"  # single test by name
```

Vitest uses `vite.config.ts` (there is no separate vitest config), so the `@/` → `src/` alias works in tests. Tests live in two places: next to the code as `src/lib/*.test.ts` (pure logic) and in `test/*.test.ts` (repositories, API handlers, client service, Excel import, rules).

## Where AGENTS.md is out of date

- **Firestore writes are in repositories, not in components.** `src/services/topicRepository.ts`, `vocabularyRepository.ts` and `reviewEventRepository.ts` hold all `addDoc`/`updateDoc`/`writeBatch`/`onSnapshot` calls, plus payload sanitization and `handleFirestoreError`. Pages and feature components call these functions. `AppDataProvider` subscribes through `subscribeTopics`/`subscribeVocabularies`. Add new writes to the matching repository and test them in `test/*Repository.test.ts`.
- **Gemini runs on the server, behind an authenticated proxy.** The browser bundle never contains `GEMINI_API_KEY`.
  - Client: `src/services/geminiService.ts` gets a Firebase ID token and `POST`s to `/api/ai/word-details` or `/api/ai/batch-details`, then validates the response with Zod.
  - Server: Vercel functions in `api/ai/*.ts`. `api/lib/auth.ts` verifies the Bearer token against Google's JWKS using `jose`. `api/lib/gemini.ts` owns the `GoogleGenAI` client, the model (`gemini-2.5-flash`), the prompt and the response schema.
  - Local dev: the `devApiServerPlugin` in `vite.config.ts` loads these same handlers inside the Vite dev server, using `GEMINI_API_KEY` (and optionally `FIREBASE_PROJECT_ID`) from `.env`.
  - Production: Vercel (`vercel.json` routes `/api/*` to functions and everything else to the SPA).
- **Testing covers more than SRS.** See the Commands section above for the full test suite and where tests live.

## Architecture notes that span several files

- **Data flow:** `AppDataProvider` (auth + live `topics`/`vocabularies` snapshots) → `useAppData()` in pages → selectors in `src/lib/vocabularySelectors.ts` (due/filter/sort/overview/topic counts) and `useVocabStats` → UI. Use the existing selectors for derived lists instead of filtering inline.
- **Firestore collections:** `topics`, `vocabularies` and `reviewEvents`. All three are scoped by `userId`.
  - `vocabularies` accepts two document shapes on update: legacy and SRS v1. A create must contain exactly 17 keys, use `request.time` for timestamps, and set `lastReviewedAt == null`.
  - `reviewEvents` is append-only.
  - Adding or changing a field touches all of: `types/types.ts`, the repository payload, `firestore.rules` (the key count and the `hasOnly` list), `test/firestore.rules.test.ts`, and the readers.
- **SRS review path:** UI rating → `calculateNextSchedule` in `src/lib/srs.ts` → `recordVocabularyReview` in `vocabularyRepository.ts`, which uses one `writeBatch` to update the vocabulary schedule and create a `reviewEvents` document together. `requeueAgainOnce` controls in-session requeueing of "again" cards.
- **Duplicate detection** uses a composite key, the normalized word plus the part of speech (`getVocabularyKey` and `checkDuplicateVocabulary` in `src/lib/vocabulary.ts`). The same word with a different part of speech is a separate entry, not a duplicate.
- **Bulk/Excel import:** `lib/bulkParser.ts`, `lib/excelParser.ts` and `lib/excelTemplate.ts` (using `xlsx`) feed `BulkImportDialog` and `ImportVocabDialog`. Those dialogs call `getBatchWordDetails` and then `batchCreateVocabularies`.
- **Routing:** route pages are lazy-loaded in `routes/AppRouter.tsx` as named exports wrapped for `React.lazy`. Follow the same pattern when adding a page.
