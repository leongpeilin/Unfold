import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { UserInteraction } from "../types";

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId || "(default)"
);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

/**
 * Strict Undefined-Stripping Utility to guarantee zero-crash Firestore writes
 */
export function sanitizeFirestorePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (value === undefined) {
        return null;
      }
      return value;
    })
  );
}

/**
 * Sign in using Google Provider
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Google Sign-In Error:", error);
    throw error;
  }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Sign Out Error:", error);
    throw error;
  }
}

/**
 * Subscribe to user's private interactions in Firestore
 * Path: users/{userId}/interactions
 */
export function subscribeUserInteractions(
  userId: string,
  onUpdate: (interactions: UserInteraction[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const interactionsRef = collection(db, "users", userId, "interactions");
  const q = query(interactionsRef, orderBy("updatedAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: UserInteraction[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as UserInteraction;
        list.push({
          ...data,
          id: docSnap.id,
        });
      });
      onUpdate(list);
    },
    (err) => {
      console.error("Error subscribing to Firestore interactions:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * Save user interaction to their isolated Firestore collection
 */
export async function saveUserInteraction(
  userId: string,
  interaction: UserInteraction
): Promise<void> {
  if (!userId || !interaction.id) {
    throw new Error("Invalid userId or interaction ID for Firestore save.");
  }

  const sanitized = sanitizeFirestorePayload({
    ...interaction,
    userId,
    updatedAt: Date.now(),
  });

  const docRef = doc(db, "users", userId, "interactions", interaction.id);
  await setDoc(docRef, sanitized, { merge: true });
}

/**
 * Delete a specific interaction document
 */
export async function deleteUserInteraction(
  userId: string,
  interactionId: string
): Promise<void> {
  if (!userId || !interactionId) {
    throw new Error("Invalid userId or interaction ID for Firestore delete.");
  }

  const docRef = doc(db, "users", userId, "interactions", interactionId);
  await deleteDoc(docRef);
}

export { onAuthStateChanged };
export type { User };