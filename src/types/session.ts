import type { Timestamp } from "firebase/firestore";
export type SessionStatus = "open" | "paused" | "closed";

export interface InterviewSession {
  id: string;
  name: string;
  description: string;
  meetUrl: string;

  status: SessionStatus;

  averageInterviewMinutes: number;

  startsAt: Timestamp;
  endsAt: Timestamp;

  createdAt: Timestamp;
  createdBy: string;
}

export interface CreateSessionInput {
  name: string;
  description: string;
  meetUrl: string;

  averageInterviewMinutes: number;

  startsAt: Date;
  endsAt: Date;
}
