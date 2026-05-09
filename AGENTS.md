## Vibe English - AI context

### What this repo is
- Single-app React + Vite project for building a personal English vocabulary trainer.
- Uses Firebase Auth + Firestore for user data and Gemini API for AI word lookup.
- Tailwind CSS + shadcn/ui style components for UI.

### Tech stack
- React 19, TypeScript, Vite
- Firebase (Auth, Firestore)
- Google GenAI SDK (Gemini)
- Tailwind CSS 4, shadcn/ui, lucide-react, motion

### Project structure
Root files
- package.json: scripts and dependencies
- firebase-applet-config.json: Firebase app config (used by src/lib/firebase.ts)
- firestore.rules: Firestore rules
- index.html, vite.config.ts, tsconfig.json

src/
- main.tsx: React entry
- App.tsx: main app UI, auth, data fetching, SRS logic
- index.css: global styles
- lib/
	- audio.ts: text-to-speech helpers
	- firebase.ts: Firebase init and Firestore connection test
	- firestoreErrors.ts: Firestore error mapping
	- utils.ts: helper utilities (classnames)
- services/
	- geminiService.ts: Gemini API client and word detail lookup
- components/
	- features/: AddVocabDialog, EditVocabDialog, StudyArea, TopicDialog, VocabCard
	- ui/: badge, button, card, dialog, input, scroll-area, select, sonner, tabs
- constants/
	- vocab.ts: SRS config and vocab constants
- hooks/
	- useVocabStats.ts: vocab stats calculations
- pages/: DashboardPage, DictionaryPage, LoginPage, StudyPage, TopicsPage
- routes/: AppDataProvider, AppLayout, AppRouter, RouteGuards
- types/
	- types.ts: shared types (Topic, Vocabulary, SRS intervals, etc.)
- store/, utils/: empty placeholders

### Source code diagram
repo
├─ src
│  ├─ main.tsx -> mounts App
│  ├─ App.tsx -> wraps AppDataProvider + AppRouter
│  ├─ components/
│  │  ├─ features/* -> Add/Edit vocab, StudyArea, TopicDialog, VocabCard
│  │  └─ ui/* -> shared UI primitives
│  ├─ constants/vocab.ts -> SRS intervals and constants
│  ├─ hooks/useVocabStats.ts -> vocab stats
│  ├─ lib/* -> audio helpers, Firebase init, error mapping, utilities
│  ├─ pages/* -> Dashboard, Dictionary, Login, Study, Topics
│  ├─ routes/* -> AppDataProvider, AppLayout, AppRouter, RouteGuards
│  ├─ services/geminiService.ts -> Gemini word details
│  └─ types/types.ts -> shared types
└─ firebase-applet-config.json -> Firebase config

### How to work here
Commands
```
npm run dev      # start Vite dev server
npm run build    # production build
npm run preview  # preview production build
npm run lint     # typecheck (tsc --noEmit)
```

Environment
- GEMINI_API_KEY must be set for Gemini calls.
- Firebase config comes from firebase-applet-config.json.

Verification
- For UI changes: run dev server and check key flows (login, add vocab, AI lookup).
- For logic/type changes: run npm run lint.
