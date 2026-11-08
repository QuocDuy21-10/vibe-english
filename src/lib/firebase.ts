import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Opt-in for local E2E runs only: a demo- project id makes any call that escapes the emulators fail instead of reaching production.
const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

export const firebaseApp = initializeApp(useEmulators ? { ...firebaseConfig, projectId: 'demo-vibe-english' } : firebaseConfig);
export const auth = getAuth(firebaseApp);
// IndexedDB cache lets listeners resume from local data instead of re-reading every document on each app load.
// The SDK falls back to memory cache when IndexedDB is unavailable.
export const db = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
}, firebaseConfig.firestoreDatabaseId);

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9199', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8180);
}
