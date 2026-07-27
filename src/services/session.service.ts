import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "../lib/firebase";
import type { CreateSessionInput, InterviewSession } from "../types/session";

export async function createSession(
  input: CreateSessionInput,
): Promise<string> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be logged in.");
  }

  const sessionsRef = collection(db, "sessions");

  const session = await addDoc(sessionsRef, {
    name: input.name,
    description: input.description,
    meetUrl: input.meetUrl,

    active: true,

    averageInterviewMinutes: input.averageInterviewMinutes,

    startsAt: Timestamp.fromDate(input.startsAt),
    endsAt: Timestamp.fromDate(input.endsAt),

    createdAt: serverTimestamp(),
    createdBy: user.uid,
  });

  return session.id;
}

export async function getSession(
  sessionId: string,
): Promise<InterviewSession | null> {
  const sessionRef = doc(db, "sessions", sessionId);
  const snapshot = await getDoc(sessionRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as InterviewSession;
}

export function subscribeToSession(
  sessionId: string,
  callback: (session: InterviewSession | null) => void,
) {
  return onSnapshot(doc(db, "sessions", sessionId), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    callback({
      id: snapshot.id,
      ...snapshot.data(),
    } as InterviewSession);
  });
}

export async function getActiveSessions(): Promise<InterviewSession[]> {
  const sessionsRef = collection(db, "sessions");

  const activeSessionsQuery = query(sessionsRef, where("active", "==", true));

  const snapshot = await getDocs(activeSessionsQuery);

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  })) as InterviewSession[];
}
