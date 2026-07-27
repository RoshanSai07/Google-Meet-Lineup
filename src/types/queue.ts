import type { Timestamp } from "firebase/firestore";

export type QueueStatus =
  "waiting" | "next" | "interviewing" | "completed" | "skipped";

export interface QueueEntry {
  name: string;
  email: string;
  joinedAt: Timestamp;
  status: QueueStatus;
  nextAt?: Timestamp;
  interviewStartedAt?: Timestamp;
  completedAt?: Timestamp;
  skippedAt?: Timestamp;
}

export interface QueueEntryWithId extends QueueEntry {
  id: string;
}
