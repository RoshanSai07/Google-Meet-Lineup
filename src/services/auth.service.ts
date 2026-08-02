import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db, googleProvider } from "../lib/firebase";

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);

  await ensureUserProfile(result.user);

  return result.user;
}

async function ensureUserProfile(user: User) {
  const userRef = doc(db, "users", user.uid);

  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) {
    return;
  }

  await setDoc(userRef, {
    name: user.displayName ?? "User",
    email: user.email ?? "",
    photoURL: user.photoURL ?? "",
    role: "candidate",
    createdAt: serverTimestamp(),
  });
}

export async function logout() {
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function isAdmin(userId: string) {
  const userRef = doc(db, "users", userId);

  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return false;
  }

  const role = snapshot.data().role;

  return role === "admin" || role === "superadmin";
}

export async function isSuperAdmin(userId: string) {
  const userRef = doc(db, "users", userId);

  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return false;
  }

  return snapshot.data().role === "superadmin";
}
