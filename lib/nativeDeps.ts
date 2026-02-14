type FirebaseAuthModule = typeof import("@react-native-firebase/auth").default;
type FirestoreModule = typeof import("@react-native-firebase/firestore").default;
type AsyncStorageModule = typeof import("@react-native-async-storage/async-storage").default;

let cachedAuth: FirebaseAuthModule | null | undefined;
let cachedFirestore: FirestoreModule | null | undefined;
let cachedAsyncStorage: AsyncStorageModule | null | undefined;

function reportOnce(key: string, error: unknown) {
  const cacheKey = `__MC_NATIVE_DEP_ERROR_${key}`;
  const g = globalThis as Record<string, unknown>;
  if (g[cacheKey]) return;
  g[cacheKey] = true;
  console.error(`Native dependency init failed: ${key}`, error);
}

export function getFirebaseAuth(): FirebaseAuthModule | null {
  if (cachedAuth !== undefined) return cachedAuth;
  try {
    cachedAuth = require("@react-native-firebase/auth").default as FirebaseAuthModule;
  } catch (error) {
    cachedAuth = null;
    reportOnce("auth", error);
  }
  return cachedAuth;
}

export function getFirebaseFirestore(): FirestoreModule | null {
  if (cachedFirestore !== undefined) return cachedFirestore;
  try {
    cachedFirestore = require("@react-native-firebase/firestore").default as FirestoreModule;
  } catch (error) {
    cachedFirestore = null;
    reportOnce("firestore", error);
  }
  return cachedFirestore;
}

export function getAsyncStorage(): AsyncStorageModule | null {
  if (cachedAsyncStorage !== undefined) return cachedAsyncStorage;
  try {
    cachedAsyncStorage = require("@react-native-async-storage/async-storage").default as AsyncStorageModule;
  } catch (error) {
    cachedAsyncStorage = null;
    reportOnce("async-storage", error);
  }
  return cachedAsyncStorage;
}
