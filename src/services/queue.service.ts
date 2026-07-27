import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";

import type { User } from "firebase/auth";

import { db } from "../lib/firebase";
import type { QueueEntry, QueueEntryWithId, QueueStatus } from "../types/queue";

export interface PublicLiveState {
  currentCandidateNumber: number | null;
  interviewStartedAt: Timestamp | null;
  waitingCount: number;
  completedCount: number;
  averageInterviewMinutes: number | null;
  updatedAt: Timestamp | null;
}

export function subscribeToMyQueueEntry(
  sessionId: string,
  userId: string,
  callback: (entry: QueueEntry | null) => void,
): Unsubscribe {
  const entryRef = doc(db, "sessions", sessionId, "queue", userId);

  return onSnapshot(entryRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    callback(snapshot.data() as QueueEntry);
  });
}

export function subscribeToQueue(
  sessionId: string,
  callback: (entries: QueueEntryWithId[]) => void,
): Unsubscribe {
  const queueRef = collection(db, "sessions", sessionId, "queue");
  const queueQuery = query(queueRef, orderBy("joinedAt", "asc"));

  return onSnapshot(queueQuery, (snapshot) => {
    const entries = snapshot.docs.map((queueDoc) => ({
      id: queueDoc.id,
      ...(queueDoc.data() as QueueEntry),
    }));

    callback(entries);
  });
}

export function subscribeToPublicLiveState(
  sessionId: string,
  callback: (state: PublicLiveState | null) => void,
): Unsubscribe {
  const liveRef = doc(db, "sessions", sessionId, "public", "live");

  return onSnapshot(liveRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    callback(snapshot.data() as PublicLiveState);
  });
}

export async function updateQueueStatus(
  sessionId: string,
  userId: string,
  status: QueueStatus,
) {
  const entryRef = doc(db, "sessions", sessionId, "queue", userId);

  const updates: Record<string, unknown> = {
    status,
  };

  if (status === "next") {
    updates.nextAt = serverTimestamp();
  }

  if (status === "interviewing") {
    updates.interviewStartedAt = serverTimestamp();
  }

  if (status === "completed") {
    updates.completedAt = serverTimestamp();
  }

  if (status === "skipped") {
    updates.skippedAt = serverTimestamp();
  }

  await updateDoc(entryRef, updates);
  await syncPublicLiveState(sessionId);
}

export async function joinQueue(sessionId: string, user: User) {
  const entryRef = doc(db, "sessions", sessionId, "queue", user.uid);

  await setDoc(entryRef, {
    name: user.displayName ?? "Candidate",
    email: user.email ?? "",
    joinedAt: serverTimestamp(),
    status: "waiting",
  });
}

export async function leaveQueue(sessionId: string, userId: string) {
  const entryRef = doc(db, "sessions", sessionId, "queue", userId);

  await deleteDoc(entryRef);
}

async function syncPublicLiveState(sessionId: string) {
  const queueRef = collection(db, "sessions", sessionId, "queue");
  const queueQuery = query(queueRef, orderBy("joinedAt", "asc"));

  const snapshot = await getDocs(queueQuery);

  const entries: QueueEntryWithId[] = snapshot.docs.map((queueDoc) => ({
    id: queueDoc.id,
    ...(queueDoc.data() as QueueEntry),
  }));

  const waiting = entries.filter((entry) => entry.status === "waiting");

  const completed = entries.filter((entry) => entry.status === "completed");

  const interviewing = entries.find((entry) => entry.status === "interviewing");

  let currentCandidateNumber: number | null = null;

  if (interviewing) {
    const index = entries.findIndex((entry) => entry.id === interviewing.id);

    currentCandidateNumber = index + 1;
  }

  const interviewDurations = completed
    .filter((entry) => entry.interviewStartedAt && entry.completedAt)
    .map((entry) => {
      const started = entry.interviewStartedAt!.toMillis();
      const completed = entry.completedAt!.toMillis();

      return completed - started;
    })
    .filter((duration) => duration > 0);

  let averageInterviewMinutes: number | null = null;

  if (interviewDurations.length > 0) {
    const totalDuration = interviewDurations.reduce(
      (total, duration) => total + duration,
      0,
    );

    averageInterviewMinutes =
      totalDuration / interviewDurations.length / 1000 / 60;

    averageInterviewMinutes = Math.round(averageInterviewMinutes * 10) / 10;
  }

  const liveRef = doc(db, "sessions", sessionId, "public", "live");

  await setDoc(
    liveRef,
    {
      currentCandidateNumber,
      interviewStartedAt: interviewing?.interviewStartedAt ?? null,
      waitingCount: waiting.length,
      completedCount: completed.length,
      averageInterviewMinutes,
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    },
  );
}
