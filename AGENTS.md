# Vibe English — Repository Instructions

This file is the repository-wide instruction manual for AI coding agents. Follow it before changing code. Keep changes scoped, evidence-based, and compatible with the current Firebase data model.

## Source of truth

Use these precedence rules when sources disagree:

- **Behavior:** the current task and explicitly approved business requirements → Firestore rules, tests, and persisted data contracts → current implementation.
- **Engineering and UI practice:** this `AGENTS.md` → `DESIGN.md` and `docs/RESPONSIVE_DESIGN_GUIDELINES.md` → established patterns in the affected code.
- Files under `docs/plan/` and `docs/bug/` are historical notes, not approved requirements. In particular, their older level 0–5 and batch-update proposals do not override the current versioned SRS implementation.
- `GEMINI.md` and `docs/docs.md` contain an outdated description of `App.tsx`; use this file and current source instead.

Business requirements are constraints, not suggestions. If an unresolved conflict can change behavior, data, security, permissions, or user workflow, stop and ask the developer. Do not silently choose a business rule.

## Project overview

Vibe English is a single React application for personal English vocabulary learning. Users sign in with Google, manage topics and vocabulary in Firestore, look up word details through Gemini, and study with flashcard, quiz, and spaced-repetition flows.

Verified stack:

- npm with `package-lock.json`
- React 19, TypeScript 5.8, Vite 6, React Router 7
- Firebase Authentication and Cloud Firestore
- Google GenAI SDK for Gemini word lookup
- Tailwind CSS 4, Base UI/shadcn-style primitives, Lucide, Motion, Recharts
- React Hook Form with Zod
- Sonner notifications
- Vitest for tests

There is no HTTP backend client, React Query/SWR, Redux/Zustand, RBAC framework, date library, component-test setup, or E2E framework in this repository.

## Architecture and dependency flow

```text
src/main.tsx
  → App
    → AppDataProvider
      → AppRouter
        → route guards → AppLayout → pages
                                  → feature components
                                    → UI primitives

Data and shared dependencies:
pages/features → hooks, services, lib, constants, types
AppDataProvider → Firebase Auth + Firestore subscriptions
features/pages → Firestore mutations
firestore.rules → persisted authorization and validation boundary
```

Keep dependency direction toward shared code. `lib`, `services`, `hooks`, and `types` MUST NOT import pages or feature components. UI primitives MUST remain business-agnostic.

## Repository structure and placement

```text
src/
├── components/
│   ├── features/   # Vocabulary, topic, and study UI with feature behavior
│   └── ui/         # Reusable Base UI/shadcn-style primitives
├── constants/      # Shared vocabulary and route/filter constants
├── hooks/          # Reusable React-derived state and calculations
├── lib/            # Firebase setup, error/audio helpers, pure SRS logic, utilities
├── pages/          # Route-level screen composition
├── routes/         # Router, guards, layout, and app-wide data context
├── services/       # External SDK integrations such as Gemini
└── types/          # Shared domain and error types
```

- Add route-level screens to `pages/` and register routes in `routes/AppRouter.tsx`.
- Put reusable feature UI in `components/features/`; keep pages focused on composition and page-level state.
- Reuse or extend `components/ui/` before creating another button, input, card, dialog, select, badge, tabs, or scroll primitive. Keep generated primitive conventions local to that directory.
- Put reusable React computations in `hooks/`, pure business calculations or infrastructure helpers in `lib/`, and third-party SDK calls in `services/`.
- Keep shared persisted/domain shapes in `types/` and shared business identifiers in `constants/`.
- `src/store/` and `src/utils/` are empty placeholders. MUST NOT populate them merely to match a preferred architecture.
- Do not add nested `AGENTS.md` files unless a future module develops materially different architecture or business rules.

## Components and UI

MUST search before creating. Check, in order: a similar feature component, an existing UI primitive, the same-module pattern, then shared hooks/lib/constants/types.

- Prefer **reuse → extend → refactor → create**. Do not duplicate a component because only copy, styling, or a few props differ.
- Use composition through pages, `AppLayout`, and feature components. Do not move business behavior into `components/ui/`.
- Follow the palette, typography, spacing, and shape direction in `DESIGN.md`. Existing code mixes theme tokens, Tailwind palette classes, and approved brand hex values; do not introduce a new palette or perform unrelated style normalization.
- Follow `docs/RESPONSIVE_DESIGN_GUIDELINES.md` for newly added or modified UI: mobile-first classes, logical DOM order, touch-friendly controls, and `dvh`-based full-height layouts. Do not mass-rewrite unrelated existing `h-screen` or hardcoded styles.
- Reuse existing loading (`Loader2`/pending state), empty-state, disabled-state, dialog, pagination, and filter patterns. There is no generic table component; do not invent one unless the task needs reusable tabular behavior.
- Preserve visible Vietnamese product copy unless the task explicitly changes localization. There is no i18n framework.

## Data fetching and mutations

- `routes/AppDataProvider.tsx` is the app-wide source for the Firebase user, auth loading state, topics, and vocabularies. It subscribes with Firestore `onSnapshot` and exposes data through `useAppData()`.
- Current mutations are colocated in the owning page or feature component and call Firestore SDK functions through `db` from `lib/firebase.ts`. Do not invent an HTTP API layer or force all writes into a new service abstraction for a scoped change.
- Extract a shared mutation/helper only when multiple consumers or independently testable logic justify it. Pure calculations belong outside components.
- `services/geminiService.ts` is the integration boundary for Gemini lookup. UI components should call that service instead of instantiating another Gemini client.
- Keep vocabulary creation, updates, and SRS writes aligned with `firestore.rules`. When changing persisted fields, inspect and update all affected types, create/update payloads, readers, tests, and security rules as required by the task.
- Use `serverTimestamp()` for persisted audit/review timestamps where the current contract does. Use native `Date` and Firestore `Timestamp` conversions for client calculations; do not add a date library without a demonstrated need.

## State management

- Use component-local `useState` for transient UI state such as dialogs, filters, pagination, study-session progress, and feedback.
- Use React Hook Form for form state. Do not duplicate form fields into local state unless a distinct interaction requires it.
- Use `useMemo` for derived collections/statistics when consistent with current patterns; do not store derivable values as global state.
- Use `AppDataProvider`/`useAppData` for existing app-wide auth and Firestore subscription data. Do not add another global store or duplicate these subscriptions in pages.
- React Router owns route/path state. The app currently has no query-parameter state convention; introduce one only when the task requires shareable or navigable filters.

## Authentication and authorization

- Firebase Auth state is established by `onAuthStateChanged` in `AppDataProvider`.
- Login uses `GoogleAuthProvider` with `signInWithPopup`; logout uses Firebase `signOut`.
- `RequireAuth` and `PublicOnly` protect routes. Never bypass these guards to make a screen render.
- Firestore queries scope documents by `userId`, and `firestore.rules` enforces signed-in ownership and field validation. Client-side filtering is not authorization.
- There are no roles, permissions, admin routes, or component-level RBAC checks. MUST NOT invent or simulate them.

## Forms and validation

- Use React Hook Form with a colocated Zod schema and `zodResolver`, following the add/edit vocabulary and topic dialogs.
- Infer form value types with `z.infer`; use `Controller` for controlled Base UI components such as `Select`.
- Trim and normalize values before writes. Show field errors near inputs, use `aria-invalid`, disable duplicate submits, and expose pending state.
- Keep Firestore validation in `firestore.rules`; client validation improves UX but MUST NOT be treated as the security boundary.
- Do not introduce another form or validation library.

## Errors, loading, and notifications

- Use `handleFirestoreError` for Firestore failures when the current flow does; it reports structured operation/auth/path context without throwing. Callers should provide an appropriate Sonner toast or recoverable UI state.
- Use `toast.success`, `toast.info`, or `toast.error` for user-visible operation outcomes, consistent with nearby flows.
- Never use an empty `catch`, silently swallow a failed write, or advance SRS UI after persistence fails.
- Log diagnostic detail without exposing API keys, credentials, or sensitive user data. There is no global error boundary; do not claim one exists.

## SRS rules

- `src/lib/srs.ts` is the source for versioned schedule normalization, rating calculations, due-date checks, derived level 0–4, and requeue behavior. Keep this logic pure and unit-tested.
- Persist SRS changes only with fields allowed by `firestore.rules`; preserve legacy-document compatibility unless the task explicitly removes it.
- Do not recreate SRS formulas inside components or use historical level 0–5 intervals from old notes.
- MUST NOT invent ratings, transitions, review intervals, mastery rules, migration behavior, or Firestore fields.

## TypeScript, naming, and imports

- Preserve type safety. MUST NOT add `any`, `@ts-ignore`, or `@ts-nocheck` to avoid a type error. If an unavoidable boundary requires a cast, keep it narrow and explain why.
- Use interfaces for shared domain object shapes where that is the current pattern; use type aliases for props, form values, unions, and utility results.
- Model `null` and optional persisted fields explicitly. Do not weaken a shared type without checking Firestore payloads and readers.
- Naming: PascalCase for React components, pages, and feature filenames; `useX` for hooks; camelCase for functions/variables; UPPER_SNAKE_CASE for shared constants; descriptive PascalCase for types/interfaces.
- Prefer `@/` for imports across `src` directories. Use relative imports for files in the same directory and for the entrypoint's local imports. Do not create barrel files solely for shorter imports.
- Import third-party modules before project modules and keep type-only imports explicit where practical.
- There is no ESLint or Prettier configuration. Preserve the affected file's quote/semicolon style and MUST NOT format or rewrite unrelated files.

## Environment and secrets

- `firebase-applet-config.json` supplies Firebase client configuration and is gitignored.
- `.env.example` documents `GEMINI_API_KEY` and `APP_URL`; `APP_URL` is currently unused.
- `vite.config.ts` injects `GEMINI_API_KEY` into the browser bundle as `process.env.GEMINI_API_KEY`. Treat it as client-exposed under the current architecture, not as a server-side secret.
- Never commit `.env`, expose additional secrets to Vite, log secret values, or add fallback credentials.
- Bắt buộc phải hỏi người dùng trước khi đọc nội dung file `.env` (tuyệt đối không tự ý đọc file `.env`).

## Tests and commands

Use only repository scripts:

```bash
npm run dev       # Vite dev server on 0.0.0.0:3000
npm run lint      # TypeScript check: tsc --noEmit (not ESLint)
npm test          # Vitest run
npm run build     # Production Vite build
npm run preview   # Preview the production build
npm run clean     # Remove ignored dist output; run only when needed
npm run fb        # Deploy Firestore rules to the cloud
```

- Vitest tests are colocated as `*.test.ts`; current coverage is pure SRS logic in `src/lib/srs.test.ts`.
- Add or update unit tests for changed pure business logic and edge cases. Do not require component or E2E tests unless the task adds the supporting infrastructure.
- For UI changes, also run the dev server and manually verify the affected responsive flow. Auth, Firestore, and Gemini checks require valid runtime configuration; report anything not verified.
- Before finishing code changes, run `npm run lint`, relevant tests, and `npm run build`. Run `git diff --check` and review the final scoped diff. Never claim a check passed unless it was run successfully.

## AI agent workflow

1. **Understand:** read this file, the task, relevant approved requirements, `DESIGN.md`/responsive guidance for UI work, and the full affected data flow.
2. **Search before coding:** find existing components, hooks, SDK calls, types, constants, validation schemas, Firestore rules, and test patterns.
3. **Plan scope:** identify files to edit/create, reusable code, persisted-contract impact, side effects, and risks. Preserve unrelated working-tree changes.
4. **Implement:** follow reuse → extend → refactor → create. Keep abstractions proportional to current reuse needs.
5. **Validate:** run the applicable repository commands and manually verify UI/runtime flows when required.
6. **Review:** check for duplication, architecture violations, hardcoded business rules, auth bypasses, unsafe types, unused code, out-of-scope edits, and contract drift.

## Critical rules

### MUST

- Read affected code and search before creating anything.
- Reuse existing primitives and domain logic.
- Keep changes within task scope and preserve backward compatibility unless a breaking change is explicitly requested.
- Keep Firestore writes, shared types, rules, and SRS behavior consistent.
- Mỗi khi thay đổi file `firestore.rules`, bắt buộc phải chạy script `npm run fb` để deploy và đồng bộ rules lên Firebase console.
- Preserve authentication, ownership checks, type safety, and responsive behavior.
- Bắt buộc phải hỏi và xin phép người dùng trước khi đọc nội dung file `.env` (tuyệt đối không tự ý đọc file `.env`).
- Report verified results separately from unverified runtime assumptions.

### MUST NOT

- Tuyệt đối KHÔNG commit file `.env` (hoặc bất kỳ file môi trường/secrets/credentials nào) vào git.
- Tuyệt đối KHÔNG tự ý đọc file `.env` khi chưa hỏi và chưa có sự đồng ý của người dùng.
- Change architecture or add a dependency without task-level justification.
- Duplicate a component, hook, service, utility, schema, constant, or business calculation.
- Bypass authentication or Firestore authorization.
- Invent statuses, roles, permissions, workflows, transitions, validation, formulas, or API behavior.
- Change persisted contracts or Gemini behavior outside the requested scope.
- Delete code you do not understand, refactor unrelated modules, or perform broad cleanup/formatting.
- Add speculative abstractions, global state, API wrappers, or placeholder files.
- Hide failures with `any`, TypeScript suppression, empty catches, or misleading validation claims.
