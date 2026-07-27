import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { Timestamp } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";

import { isAdmin, logout, subscribeToAuth } from "../services/auth.service";
import {
  leaveQueue,
  subscribeToMyQueueEntry,
  subscribeToPublicLiveState,
  subscribeToQueue,
  updateQueueStatus,
  type PublicLiveState,
} from "../services/queue.service";
import { subscribeToSession } from "../services/session.service";

import { sendNotification } from "../services/notification.service";

import type { QueueEntry, QueueEntryWithId, QueueStatus } from "../types/queue";
import type { InterviewSession } from "../types/session";

type LineupNotification = {
  id: number;
  type: "next" | "interviewing" | "skipped" | "completed";
  title: string;
  description: string;
};

export default function Queue() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState(false);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [entry, setEntry] = useState<QueueEntry | null>(null);
  const [queue, setQueue] = useState<QueueEntryWithId[]>([]);
  const [liveState, setLiveState] = useState<PublicLiveState | null>(null);

  const [authLoading, setAuthLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(true);
  const previousStatus = useRef<QueueStatus | null>(null);
  const [notifications, setNotifications] = useState<LineupNotification[]>([]);

  const showLineupNotification = (
    type: LineupNotification["type"],
    title: string,
    description: string,
  ) => {
    const id = Date.now();

    setNotifications((current) => [
      ...current,
      {
        id,
        type,
        title,
        description,
      },
    ]);

    if (type === "next" || type === "completed") {
      window.setTimeout(() => {
        setNotifications((current) =>
          current.filter((notification) => notification.id !== id),
        );
      }, 8000);
    }
  };

  const dismissNotification = (id: number) => {
    setNotifications((current) =>
      current.filter((notification) => notification.id !== id),
    );
  };

  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setAdmin(false);
        setAuthLoading(false);
        setRoleLoading(false);
        return;
      }

      try {
        setAdmin(await isAdmin(currentUser.uid));
      } catch (error) {
        console.error("Failed to determine role:", error);
        setAdmin(false);
      } finally {
        setAuthLoading(false);
        setRoleLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setSessionLoading(false);
      return;
    }

    return subscribeToSession(sessionId, (currentSession) => {
      setSession(currentSession);
      setSessionLoading(false);
    });
  }, [sessionId]);

  useEffect(() => {
    if (!user || !sessionId || admin || roleLoading) return;

    const unsubscribe = subscribeToMyQueueEntry(
      sessionId,
      user.uid,
      (currentEntry) => {
        setEntry(currentEntry);

        if (!currentEntry) {
          previousStatus.current = null;
          return;
        }

        const oldStatus = previousStatus.current;
        const newStatus = currentEntry.status;

        if (oldStatus && oldStatus !== newStatus) {
          if (newStatus === "next") {
            showLineupNotification(
              "next",
              "You're next",
              "Stay ready. Your interview will begin shortly.",
            );

            sendNotification(
              "You're next!",
              "Stay ready. Your interview will begin shortly.",
              "lineup-next",
            );
          }

          if (newStatus === "interviewing") {
            showLineupNotification(
              "interviewing",
              "It's your turn",
              "Your interview is ready. Join the meeting now.",
            );

            sendNotification(
              "It's your turn!",
              "Your interview is ready. Join the meeting now.",
              "lineup-interviewing",
            );
          }

          if (newStatus === "skipped") {
            showLineupNotification(
              "skipped",
              "Your turn was skipped",
              "Contact the interview team if you're still available.",
            );

            sendNotification(
              "Your turn was skipped",
              "Check Lineup or contact the interview team if you're still available.",
              "lineup-skipped",
            );
          }

          if (newStatus === "completed") {
            showLineupNotification(
              "completed",
              "Interview completed",
              "You're all done. Thanks for your time!",
            );

            sendNotification(
              "Interview completed",
              "You're all done. Thanks for your time!",
              "lineup-completed",
            );
          }
        }

        previousStatus.current = newStatus;
      },
    );

    return unsubscribe;
  }, [user, sessionId, admin, roleLoading]);

  useEffect(() => {
    if (!user || !sessionId || !admin || roleLoading) return;
    return subscribeToQueue(sessionId, setQueue);
  }, [user, sessionId, admin, roleLoading]);

  useEffect(() => {
    if (!user || !sessionId) return;
    return subscribeToPublicLiveState(sessionId, setLiveState);
  }, [user, sessionId]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (authLoading || roleLoading || sessionLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    navigate("/", { replace: true });
    return null;
  }

  if (!sessionId || !session) {
    return (
      <StateScreen
        title="Session not found"
        description="This interview session may have been removed or the link is incorrect."
        button="Return home"
        onClick={() => navigate("/")}
      />
    );
  }

  return (
    <main className="min-h-dvh bg-[var(--background)] px-5 text-[var(--foreground)] sm:px-8 lg:px-12">
      <NotificationStack
        notifications={notifications}
        meetUrl={session?.meetUrl}
        onDismiss={dismissNotification}
      />
      <div className="mx-auto flex min-h-dvh max-w-7xl flex-col">
        <Navbar user={user} admin={admin} onLogout={handleLogout} />

        {admin ? (
          <AdminHall
            session={session}
            sessionId={sessionId}
            queue={queue}
            liveState={liveState}
            onBack={() => navigate("/admin")}
          />
        ) : (
          <CandidateHall
            session={session}
            sessionId={sessionId}
            user={user}
            entry={entry}
            liveState={liveState}
            onBack={() => navigate("/user")}
          />
        )}

        <footer className="flex h-14 shrink-0 items-center justify-between border-t border-[var(--border)] text-xs text-[var(--muted)] sm:h-16">
          <span>Lineup</span>
          <span>{admin ? "Admin waiting hall" : "Interview waiting hall"}</span>
        </footer>
      </div>
    </main>
  );
}

function CandidateHall({
  session,
  sessionId,
  user,
  entry,
  liveState,
  onBack,
}: {
  session: InterviewSession;
  sessionId: string;
  user: User;
  entry: QueueEntry | null;
  liveState: PublicLiveState | null;
  onBack: () => void;
}) {
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const handleLeave = async () => {
    try {
      setLeaving(true);
      await leaveQueue(sessionId, user.uid);
      onBack();
    } catch (error) {
      console.error("Failed to leave queue:", error);
      setLeaving(false);
    }
  };

  if (!entry) {
    return (
      <div className="flex-1 py-8 sm:py-12">
        <PageBack onClick={onBack}>Back to interviews</PageBack>

        <div className="glass mt-6 rounded-xl p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
            Not in queue
          </p>

          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
            You're not checked in
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
            Return to your interviews and join this session to enter the waiting
            hall.
          </p>

          <button
            onClick={onBack}
            className="mt-6 cursor-pointer rounded-lg bg-[var(--foreground)] px-5 py-2.5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90"
          >
            Back to interviews
          </button>
        </div>
      </div>
    );
  }

  const status = getCandidateStatus(entry.status);

  return (
    <div className="flex-1 py-8 sm:py-12">
      <PageBack onClick={onBack}>Back to interviews</PageBack>

      <header className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <LiveDot />

            <span className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--accent)]">
              Live interview session
            </span>
          </div>

          <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            {session.name}
          </h1>

          <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
            {session.description ||
              "Keep this page open while you wait for your interview."}
          </p>
        </div>

        {entry.status === "waiting" && (
          <button
            onClick={() => setLeaveOpen(true)}
            className="cursor-pointer rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          >
            Leave waitlist
          </button>
        )}
      </header>

      <section className="mt-8">
        <article
          className={`relative overflow-hidden border rounded-xl p-5 text-white shadow-lg transition-all duration-500 sm:p-7 ${status.card} ${status.border}`}
        >
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute -right-24 -top-24 size-64 rounded-full opacity-[0.07] blur-3xl transition-colors duration-500 ${status.glow}`}
          />

          <div className="relative">
            <div className="flex items-center gap-2">
              <span className={`size-1.5 rounded-full ${status.dot}`} />

              <span
                className={`text-xs font-semibold uppercase tracking-[0.16em] ${status.text}`}
              >
                {status.label}
              </span>
            </div>

            <div className="mt-5">
              <h2 className="text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
                {status.title}
              </h2>

              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                {status.description}
              </p>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:max-w-3xl">
              <SessionDetail
                label="Checked in"
                value={formatTime(entry.joinedAt)}
              />

              <LiveDetail
                label={
                  entry.status === "completed" ? "Total time" : "Waiting for"
                }
                timestamp={entry.joinedAt}
              />

              <SessionDetail
                label="Interview"
                value={
                  liveState?.averageInterviewMinutes
                    ? `~${liveState.averageInterviewMinutes} min`
                    : `~${session.averageInterviewMinutes} min`
                }
                className="col-span-2 sm:col-span-1"
              />
            </div>

            {entry.status === "interviewing" && (
              <div className="mt-7 flex flex-col gap-3 border-t border-emerald-500/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-40" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>

                  <p className="text-xs text-[var(--muted)]">
                    Your interview has started. Join the meeting when you're
                    ready.
                  </p>
                </div>

                {session.meetUrl && (
                  <a
                    href={session.meetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:opacity-90 active:translate-y-0"
                  >
                    Join Google Meet
                    <span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        height="17px"
                        viewBox="0 -960 960 960"
                        width="17px"
                        fill="#e3e3e3"
                      >
                        <path d="m256-240-56-56 384-384H240v-80h480v480h-80v-344L256-240Z" />
                      </svg>
                    </span>
                  </a>
                )}
              </div>
            )}

            {entry.status === "completed" && (
              <div className="mt-7 flex flex-col gap-3 border-t border-emerald-500/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[var(--muted)]">
                  Your interview is complete. You can leave the waiting hall.
                </p>

                <button
                  onClick={onBack}
                  disabled={leaving}
                  className="cursor-pointer rounded-lg bg-[var(--foreground)] px-5 py-2.5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {leaving ? "Leaving..." : "Leave session"}
                </button>
              </div>
            )}
          </div>
        </article>
      </section>
      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <CurrentInterviewCard liveState={liveState} session={session} />

        <article className="glass rounded-xl p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-[var(--muted)]" />

            <span className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
              Session progress
            </span>
          </div>

          <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em]">
            Interview activity
          </h2>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <SessionDetail
              label="Completed"
              value={String(liveState?.completedCount ?? 0)}
            />
            <SessionDetail
              label="Waiting"
              value={String(liveState?.waitingCount ?? "—")}
            />
          </div>

          <div className="mt-5 border-t border-[var(--border)] pt-5">
            <p className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <LiveDot />
              Updates automatically as interviews progress.
            </p>
          </div>
        </article>
      </section>

      {leaveOpen && (
        <ConfirmModal
          eyebrow="Leave queue"
          title="Leave the waitlist?"
          description="You'll lose your current place. If you join again, you'll enter at the end of the queue."
          confirmLabel="Leave waitlist"
          loadingLabel="Leaving..."
          loading={leaving}
          danger
          onClose={() => setLeaveOpen(false)}
          onConfirm={handleLeave}
        />
      )}
    </div>
  );
}

function CurrentInterviewCard({
  liveState,
  session,
}: {
  liveState: PublicLiveState | null;
  session: InterviewSession;
}) {
  const active =
    liveState?.currentCandidateNumber != null &&
    liveState.interviewStartedAt != null;

  return (
    <article className="glass relative overflow-hidden rounded-xl p-5 sm:p-7">
      {active && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-[var(--accent)] opacity-[0.05] blur-3xl"
        />
      )}

      <div className="relative">
        <div className="flex items-center gap-2">
          {active ? (
            <LiveDot />
          ) : (
            <span className="size-1.5 rounded-full bg-[var(--muted)]" />
          )}

          <span
            className={`text-xs font-medium uppercase tracking-[0.16em] ${active ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
          >
            Current interview
          </span>
        </div>

        {active ? (
          <>
            <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
              Candidate{" "}
              {String(liveState.currentCandidateNumber).padStart(2, "0")}
            </h2>

            <p className="mt-1.5 text-sm text-[var(--muted)]">
              Interview currently in progress.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <SessionDetail
                label="Started"
                value={formatTime(liveState.interviewStartedAt!)}
              />
              <LiveDetail
                label="Elapsed"
                timestamp={liveState.interviewStartedAt!}
                timer
              />
            </div>

            <div className="mt-3">
              <SessionDetail
                label="Average interview"
                value={
                  liveState.averageInterviewMinutes
                    ? `~${liveState.averageInterviewMinutes} min`
                    : `~${session.averageInterviewMinutes} min`
                }
              />
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em]">
              Room available
            </h2>

            <p className="mt-1.5 max-w-md text-sm leading-6 text-[var(--muted)]">
              There isn't an interview in progress right now. The team may be
              preparing the next candidate.
            </p>
          </>
        )}
      </div>
    </article>
  );
}

function AdminHall({
  session,
  sessionId,
  queue,
  liveState,
  onBack,
}: {
  session: InterviewSession;
  sessionId: string;
  queue: QueueEntryWithId[];
  liveState: PublicLiveState | null;
  onBack: () => void;
}) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<QueueEntryWithId | null>(
    null,
  );

  const waiting = useMemo(
    () => queue.filter((candidate) => candidate.status === "waiting"),
    [queue],
  );

  const next = useMemo(
    () => queue.find((candidate) => candidate.status === "next") ?? null,
    [queue],
  );

  const interviewing = useMemo(
    () =>
      queue.find((candidate) => candidate.status === "interviewing") ?? null,
    [queue],
  );

  const completed = useMemo(
    () => queue.filter((candidate) => candidate.status === "completed"),
    [queue],
  );

  //   const skipped = useMemo(
  //     () => queue.filter((candidate) => candidate.status === "skipped"),
  //     [queue],
  //   );

  const updateStatus = async (
    candidate: QueueEntryWithId,
    status: QueueStatus,
  ) => {
    try {
      setUpdating(candidate.id);
      await updateQueueStatus(sessionId, candidate.id, status);
    } catch (error) {
      console.error("Failed to update candidate:", error);
    } finally {
      setUpdating(null);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;

    try {
      setUpdating(removeTarget.id);
      await leaveQueue(sessionId, removeTarget.id);
      setRemoveTarget(null);
    } catch (error) {
      console.error("Failed to remove candidate:", error);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="flex-1 py-8 sm:py-12">
      <PageBack onClick={onBack}>Back to sessions</PageBack>

      <header className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <LiveDot />

            <span className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--accent)]">
              Live interview session
            </span>
          </div>

          <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            {session.name}
          </h1>

          <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
            Manage candidates and control the interview queue.
          </p>
        </div>

        {session.meetUrl && (
          <a
            href={session.meetUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-5 py-3 text-sm font-medium transition-colors hover:bg-[var(--surface-hover)]"
          >
            Open Google Meet
            <span>↗</span>
          </a>
        )}
      </header>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <article className="glass relative overflow-hidden rounded-xl p-5 sm:p-7">
          {interviewing && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-[var(--accent)] opacity-[0.05] blur-3xl"
            />
          )}

          <div className="relative">
            <div className="flex items-center gap-2">
              {interviewing ? (
                <LiveDot />
              ) : (
                <span className="size-1.5 rounded-full bg-[var(--muted)]" />
              )}

              <span
                className={`text-xs font-semibold uppercase tracking-[0.16em] ${interviewing ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
              >
                Current interview
              </span>
            </div>

            {interviewing ? (
              <>
                <div className="mt-5">
                  <h2 className="text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
                    {interviewing.name}
                  </h2>

                  <p className="mt-1.5 text-sm text-[var(--muted)]">
                    {interviewing.email}
                  </p>
                </div>

                <div className="mt-7 grid grid-cols-2 gap-3">
                  <SessionDetail
                    label="Started"
                    value={
                      interviewing.interviewStartedAt
                        ? formatTime(interviewing.interviewStartedAt)
                        : "—"
                    }
                  />

                  {interviewing.interviewStartedAt ? (
                    <LiveDetail
                      label="Interview time"
                      timestamp={interviewing.interviewStartedAt}
                      timer
                    />
                  ) : (
                    <SessionDetail label="Interview time" value="—" />
                  )}
                </div>

                <div className="mt-7 flex flex-col gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[var(--muted)]">
                    Complete the interview when the candidate is finished.
                  </p>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => updateStatus(interviewing, "skipped")}
                      disabled={updating === interviewing.id}
                      className="cursor-pointer rounded-lg border border-amber-500/20 px-5 py-2.5 text-sm font-medium text-amber-500 transition-colors hover:bg-amber-500/10 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {updating === interviewing.id
                        ? "Updating..."
                        : "Didn't attend"}
                    </button>

                    <button
                      onClick={() => updateStatus(interviewing, "completed")}
                      disabled={updating === interviewing.id}
                      className="cursor-pointer rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {updating === interviewing.id
                        ? "Updating..."
                        : "Complete interview"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8">
                <h2 className="text-xl font-semibold tracking-[-0.03em]">
                  No interview in progress
                </h2>

                <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                  {next
                    ? `${next.name} is ready to begin.`
                    : waiting.length
                      ? "Call the next candidate when you're ready."
                      : "Candidates will appear here as they join."}
                </p>
              </div>
            )}
          </div>
        </article>

        <article className="glass rounded-xl p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-[var(--accent)]" />

            <span className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
              Session overview
            </span>
          </div>

          <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
            Queue activity
          </h2>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <SessionDetail label="Waiting" value={String(waiting.length)} />
            <SessionDetail label="Completed" value={String(completed.length)} />
            <SessionDetail
              label="Average"
              value={
                liveState?.averageInterviewMinutes
                  ? `${liveState.averageInterviewMinutes} min`
                  : `~${session.averageInterviewMinutes} min`
              }
            />
            <SessionRemainingDetail session={session} />
          </div>
        </article>
      </section>

      <section className="mt-4">
        <article
          className={`glass relative overflow-hidden rounded-xl p-5 sm:p-7 ${next ? "" : ""}`}
        >
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-[var(--accent)]" />

            <span className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
              Up next
            </span>
          </div>

          {next ? (
            <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
                  {next.name}
                </h2>

                <p className="mt-1.5 text-sm text-[var(--muted)]">
                  {next.email}
                </p>

                {next.nextAt && (
                  <p className="mt-3 text-xs text-[var(--muted)]">
                    Called at {formatTime(next.nextAt)}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {!interviewing && (
                  <button
                    onClick={() => updateStatus(next, "interviewing")}
                    disabled={updating === next.id}
                    className="cursor-pointer rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {updating === next.id ? "Starting..." : "Start interview"}
                  </button>
                )}

                <button
                  onClick={() => updateStatus(next, "skipped")}
                  disabled={updating === next.id}
                  className="cursor-pointer rounded-lg border border-amber-500/20 px-5 py-2.5 text-sm font-medium text-amber-500 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
                >
                  {updating === next.id ? "Updating..." : "Skip"}
                </button>

                <button
                  onClick={() => setRemoveTarget(next)}
                  disabled={updating === next.id}
                  className="cursor-pointer rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <h2 className="text-lg font-semibold">Nobody called yet</h2>

              <p className="mt-1.5 text-sm text-[var(--muted)]">
                Call the first waiting candidate when you're ready.
              </p>
            </div>
          )}
        </article>
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em]">
              Waiting queue
            </h2>

            <p className="mt-1 text-sm text-[var(--muted)]">
              Candidates are ordered by check-in time.
            </p>
          </div>

          <span className="text-sm font-medium text-[var(--muted)]">
            {waiting.length} waiting
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          {waiting.length === 0 ? (
            <div className="glass flex min-h-48 flex-col items-center justify-center rounded-xl p-8 text-center">
              <h3 className="text-base font-semibold">Queue is clear</h3>

              <p className="mt-2 text-sm text-[var(--muted)]">
                New candidates will appear here automatically.
              </p>
            </div>
          ) : (
            waiting.map((candidate, index) => (
              <article
                key={candidate.id}
                className="glass rounded-xl p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--muted)]">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold sm:text-base">
                        {candidate.name}
                      </p>

                      <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                        {candidate.email}
                      </p>

                      <p className="mt-1.5 text-[0.7rem] text-[var(--muted)]">
                        Joined {formatTime(candidate.joinedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pl-14 sm:pl-0">
                    {index === 0 && !next && (
                      <button
                        onClick={() => updateStatus(candidate, "next")}
                        disabled={updating === candidate.id}
                        className="cursor-pointer rounded-lg bg-[var(--foreground)] px-4 py-2.5 text-xs font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {updating === candidate.id ? "Calling..." : "Call next"}
                      </button>
                    )}

                    <button
                      onClick={() => updateStatus(candidate, "skipped")}
                      disabled={updating === candidate.id}
                      className="cursor-pointer rounded-lg border border-amber-500/20 px-4 py-2.5 text-xs font-medium text-amber-500 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
                    >
                      {updating === candidate.id ? "Updating..." : "Skip"}
                    </button>

                    <button
                      onClick={() => setRemoveTarget(candidate)}
                      disabled={updating === candidate.id}
                      className="cursor-pointer rounded-lg border border-[var(--border)] px-4 py-2.5 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {completed.length > 0 && (
        <section className="mt-10">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em]">
              Completed
            </h2>

            <p className="mt-1 text-sm text-[var(--muted)]">
              Candidates interviewed during this session.
            </p>
          </div>

          <div className="mt-4 grid gap-3">
            {completed.map((candidate) => (
              <article
                key={candidate.id}
                className="glass rounded-xl p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/5 text-sm font-semibold text-[var(--accent)]">
                      ✓
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold sm:text-base">
                        {candidate.name}
                      </p>

                      <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                        {candidate.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-5 pl-14 text-xs text-[var(--muted)] sm:pl-0">
                    {candidate.completedAt && (
                      <span>Completed {formatTime(candidate.completedAt)}</span>
                    )}

                    {candidate.interviewStartedAt && candidate.completedAt && (
                      <span className="font-medium text-[var(--foreground)]">
                        {formatDurationBetween(
                          candidate.interviewStartedAt,
                          candidate.completedAt,
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {removeTarget && (
        <ConfirmModal
          eyebrow="Remove candidate"
          title={`Remove ${removeTarget.name}?`}
          description="They'll immediately be removed from this session. If they join again, they'll enter at the end of the queue."
          confirmLabel="Remove candidate"
          loadingLabel="Removing..."
          loading={updating === removeTarget.id}
          danger
          onClose={() => setRemoveTarget(null)}
          onConfirm={handleRemove}
        />
      )}
    </div>
  );
}

function Navbar({
  user,
  admin,
  onLogout,
}: {
  user: User;
  admin: boolean;
  onLogout: () => Promise<void>;
}) {
  return (
    <nav className="flex h-16 shrink-0 items-center justify-between sm:h-20">
      <div className="flex items-center gap-3">
        <Logo />

        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-[var(--border-strong)]">/</span>

          <span className="text-sm text-[var(--muted)]">
            {admin ? "Admin" : "Interviews"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2.5 sm:flex">
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt=""
              referrerPolicy="no-referrer"
              className="size-8 rounded-full"
            />
          )}

          <span className="max-w-40 truncate text-sm text-[var(--muted)]">
            {user.displayName}
          </span>
        </div>

        <button
          onClick={onLogout}
          className="cursor-pointer rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}

function SessionDetail({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 ${className}`}
    >
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>

      <p className="mt-2 text-sm font-semibold sm:text-base">{value}</p>
    </div>
  );
}

function LiveDetail({
  label,
  timestamp,
  timer = false,
}: {
  label: string;
  timestamp: Timestamp;
  timer?: boolean;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(
      () => setNow(Date.now()),
      timer ? 1000 : 30000,
    );

    return () => window.clearInterval(interval);
  }, [timer]);

  return (
    <SessionDetail
      label={label}
      value={
        timer
          ? formatTimer(now - timestamp.toMillis())
          : formatCompactDuration(now - timestamp.toMillis())
      }
    />
  );
}

function SessionRemainingDetail({ session }: { session: InterviewSession }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const remaining = Math.max(0, session.endsAt.toDate().getTime() - now);

  return (
    <SessionDetail
      label="Time left"
      value={remaining > 0 ? formatCompactDuration(remaining) : "Ended"}
    />
  );
}

function ConfirmModal({
  eyebrow,
  title,
  description,
  confirmLabel,
  loadingLabel,
  loading,
  danger = false,
  onClose,
  onConfirm,
}: {
  eyebrow: string;
  title: string;
  description: string;
  confirmLabel: string;
  loadingLabel: string;
  loading: boolean;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--background)] shadow-2xl sm:rounded-xl"
      >
        <div className="flex items-start justify-between border-b border-[var(--border)] px-5 py-5 sm:px-6">
          <div>
            <p
              className={`text-xs font-medium uppercase tracking-[0.15em] ${danger ? "text-red-500" : "text-[var(--accent)]"}`}
            >
              {eyebrow}
            </p>

            <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
              {title}
            </h2>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--border)] text-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="cursor-pointer rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={loading}
            className={`cursor-pointer rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${danger ? "bg-red-500" : "bg-[var(--accent)]"}`}
          >
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function PageBack({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex cursor-pointer text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height="20px"
        viewBox="0 -960 960 960"
        width="25px"
        fill="#e3e3e3"
      >
        <path d="m330-444 201 201-51 51-288-288 288-288 51 51-201 201h438v72H330Z" />
      </svg>
      {children}
    </button>
  );
}

function getCandidateStatus(status: QueueStatus) {
  switch (status) {
    case "next":
      return {
        label: "Up next",
        title: "Get ready.",
        description:
          "You're next in line. Stay nearby - your interview will begin shortly.",
        card: "bg-amber-600/10",
        dot: "bg-amber-500",
        text: "text-amber-500",
        glow: "bg-amber-500",
        border: "border-amber-500/20",
        surface: "bg-amber-500/[0.03]",
      };

    case "interviewing":
      return {
        label: "Interview ready",
        title: "It's your turn.",
        description:
          "The interview team is ready for you. Join the meeting to begin.",
        card: "bg-emerald-600/10",
        dot: "bg-emerald-600",
        text: "text-emerald-600",
        glow: "bg-emerald-600",
        border: "border-emerald-600/25",
        surface: "bg-emerald-600/[0.04]",
      };

    case "completed":
      return {
        label: "Completed",
        title: "You're all done.",
        description:
          "Your interview has been completed. Thank you for your time.",
        card: "bg-emerald-600/10",
        dot: "bg-emerald-600",
        text: "text-emerald-600",
        glow: "bg-emerald-600",
        border: "border-emerald-600/15",
        surface: "bg-emerald-600/[0.02]",
      };

    case "skipped":
      return {
        label: "Skipped",
        title: "Action needed.",
        description:
          "Your turn was skipped. Please contact the interview team if you're still available.",
        card: "bg-red-600/10",
        dot: "bg-red-600",
        text: "text-red-600",
        glow: "bg-red-600",
        border: "border-red-600/20",
        surface: "bg-red-600/[0.03]",
      };

    default:
      return {
        label: "Waiting",
        title: "You're checked in.",
        description:
          "Your place is secured. Keep this page open and we'll let you know when you're up.",
        card: "bg-[var(--accent)]/10",
        dot: "bg-[var(--accent)]",
        text: "text-[var(--accent)]",
        glow: "bg-[var(--accent)]",
        border: "border-[var(--border)]",
        surface: "",
      };
  }
}

function StateScreen({
  title,
  description,
  button,
  onClick,
}: {
  title: string;
  description: string;
  button: string;
  onClick: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--background)] px-5 text-[var(--foreground)]">
      <div className="w-full max-w-md">
        <Logo />

        <div className="glass mt-7 rounded-xl p-6">
          <h1 className="text-xl font-semibold tracking-[-0.03em]">{title}</h1>

          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {description}
          </p>

          <button
            onClick={onClick}
            className="mt-5 cursor-pointer rounded-lg bg-[var(--foreground)] px-5 py-2.5 text-sm font-medium text-[var(--background)]"
          >
            {button}
          </button>
        </div>
      </div>
    </main>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-bold text-white">
        L
      </div>

      <span className="text-lg font-semibold tracking-tight">Lineup</span>
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative flex size-2">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--accent)] opacity-40" />
      <span className="relative inline-flex size-2 rounded-full bg-[var(--accent)]" />
    </span>
  );
}

function LoadingScreen() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex items-center gap-2.5">
        <span className="size-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
        <p className="text-sm text-[var(--muted)]">Loading session...</p>
      </div>
    </main>
  );
}

function formatTime(timestamp: Timestamp) {
  return timestamp.toDate().toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDurationBetween(start: Timestamp, end: Timestamp) {
  return formatCompactDuration(Math.max(0, end.toMillis() - start.toMillis()));
}

function formatCompactDuration(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (totalMinutes > 0) return `${totalMinutes}m`;

  return "<1m";
}

function formatTimer(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function NotificationStack({
  notifications,
  meetUrl,
  onDismiss,
}: {
  notifications: LineupNotification[];
  meetUrl?: string;
  onDismiss: (id: number) => void;
}) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed left-4 right-4 top-4 z-[100] flex flex-col gap-3 sm:left-auto sm:right-6 sm:top-6 sm:w-[380px]">
      {notifications.map((notification) => {
        const interviewing = notification.type === "interviewing";
        const skipped = notification.type === "skipped";

        return (
          <article
            key={notification.id}
            className={`relative overflow-hidden rounded-xl border bg-[var(--background)] p-4 shadow-2xl backdrop-blur-xl ${interviewing ? "border-emerald-500/30" : skipped ? "border-red-500/30" : "border-[var(--border)]"}`}
          >
            <div
              className={`absolute inset-y-0 left-0 w-1 ${interviewing ? "bg-emerald-500" : skipped ? "bg-red-500" : notification.type === "next" ? "bg-amber-500" : "bg-[var(--accent)]"}`}
            />

            <div className="flex items-start gap-3 pl-2">
              <div
                className={`mt-1.5 size-2 shrink-0 rounded-full ${interviewing ? "bg-emerald-500" : skipped ? "bg-red-500" : notification.type === "next" ? "bg-amber-500" : "bg-[var(--accent)]"}`}
              />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{notification.title}</p>

                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  {notification.description}
                </p>

                {interviewing && meetUrl && (
                  <a
                    href={meetUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => onDismiss(notification.id)}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Join Google Meet
                    <span>↗</span>
                  </a>
                )}
              </div>

              <button
                onClick={() => onDismiss(notification.id)}
                aria-label="Dismiss notification"
                className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-base text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              >
                ×
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
