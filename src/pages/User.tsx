import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { useNavigate } from "react-router-dom";

import { logout, subscribeToAuth, isAdmin } from "../services/auth.service";
import { getActiveSessions } from "../services/session.service";
import { joinQueue, subscribeToMyQueueEntry } from "../services/queue.service";
import { requestNotificationPermission } from "../services/notification.service";

import type { InterviewSession } from "../types/session";
import type { QueueEntry } from "../types/queue";

export default function UserPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [queueEntries, setQueueEntries] = useState<
    Record<string, QueueEntry | null>
  >({});
  const [queueLoaded, setQueueLoaded] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [notificationSession, setNotificationSession] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (currentUser) => {
      if (!currentUser) {
        navigate("/", { replace: true });
        return;
      }

      try {
        const admin = await isAdmin(currentUser.uid);

        if (admin) {
          navigate("/admin", { replace: true });
          return;
        }

        setUser(currentUser);

        const activeSessions = await getActiveSessions();

        setSessions(activeSessions);
        setLoadError(false);
      } catch (error) {
        console.error("Failed to load candidate page:", error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!user || sessions.length === 0) return;

    const unsubscribes = sessions.map((session) =>
      subscribeToMyQueueEntry(session.id, user.uid, (entry) => {
        setQueueEntries((current) => ({
          ...current,
          [session.id]: entry,
        }));

        setQueueLoaded((current) => ({
          ...current,
          [session.id]: true,
        }));
      }),
    );

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [user, sessions]);

  const handleJoinSession = async (sessionId: string) => {
    if (!user) return;

    try {
      setJoining(sessionId);

      await joinQueue(sessionId, user);

      if ("Notification" in window && Notification.permission === "default") {
        setNotificationSession(sessionId);
        return;
      }

      navigate(`/session/${sessionId}`);
    } catch (error) {
      console.error("Failed to join session:", error);
    } finally {
      setJoining(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (loading || !user) {
    return <LoadingScreen />;
  }

  const firstName = user.displayName?.split(" ")[0] ?? "there";

  return (
    <main className="min-h-dvh bg-[var(--background)] px-5 text-[var(--foreground)] sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-dvh max-w-7xl flex-col">
        <nav className="flex h-16 shrink-0 items-center justify-between sm:h-20">
          <div className="flex items-center gap-3">
            <Logo />

            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-[var(--border-strong)]">/</span>
              <span className="text-sm text-[var(--muted)]">Interviews</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2.5 sm:flex">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="size-8 rounded-full"
                />
              ) : (
                <div className="flex size-8 items-center justify-center rounded-full bg-[var(--surface)] text-xs font-semibold">
                  {firstName.charAt(0).toUpperCase()}
                </div>
              )}

              <span className="max-w-40 truncate text-sm text-[var(--muted)]">
                {user.displayName}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="cursor-pointer rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            >
              Sign out
            </button>
          </div>
        </nav>

        <div className="flex-1 py-8 sm:py-12">
          <header className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-[var(--accent)]" />

              <span className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
                Interview check-in
              </span>
            </div>

            <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Welcome, {firstName}.
            </h1>

            <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
              {sessions.length === 0
                ? "Your available interview sessions will appear here."
                : sessions.length === 1
                  ? "Your interview session is ready when you are."
                  : "Choose an interview session to join."}
            </p>
          </header>

          {loadError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <p className="text-sm font-medium text-red-500">
                Couldn't load your sessions.
              </p>

              <p className="mt-1 text-xs text-[var(--muted)]">
                Refresh the page and try again.
              </p>
            </div>
          )}

          {!loadError && sessions.length === 0 && <EmptySessions />}

          {!loadError && sessions.length > 0 && (
            <div className="grid gap-4">
              {sessions.map((session) => {
                const entry = queueEntries[session.id] ?? null;
                const entryLoaded = queueLoaded[session.id] ?? false;

                return (
                  <CandidateSessionCard
                    key={session.id}
                    session={session}
                    entry={entry}
                    entryLoaded={entryLoaded}
                    joining={joining === session.id}
                    onJoin={() => handleJoinSession(session.id)}
                    onReturn={() => navigate(`/session/${session.id}`)}
                  />
                );
              })}
            </div>
          )}

          {!loadError && sessions.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
              <span className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-[var(--accent)]" />
                Live queue updates
              </span>

              <span>•</span>

              <span>No refreshing required</span>
            </div>
          )}
        </div>

        <footer className="flex h-14 shrink-0 items-center justify-between border-t border-[var(--border)] text-xs text-[var(--muted)] sm:h-16">
          <span>Lineup</span>
          <span>Interview check-in</span>
        </footer>
      </div>

      {notificationSession && (
        <NotificationModal
          onSkip={() => {
            const sessionId = notificationSession;
            setNotificationSession(null);
            navigate(`/session/${sessionId}`);
          }}
          onEnable={async () => {
            const sessionId = notificationSession;

            try {
              await requestNotificationPermission();
            } catch (error) {
              console.error("Notification permission failed:", error);
            }

            setNotificationSession(null);
            navigate(`/session/${sessionId}`);
          }}
        />
      )}
    </main>
  );
}

interface CandidateSessionCardProps {
  session: InterviewSession;
  entry: QueueEntry | null;
  entryLoaded: boolean;
  joining: boolean;
  onJoin: () => void;
  onReturn: () => void;
}

function CandidateSessionCard({
  session,
  entry,
  entryLoaded,
  joining,
  onJoin,
  onReturn,
}: CandidateSessionCardProps) {
  const start = session.startsAt.toDate();
  const end = session.endsAt.toDate();

  const status = getSessionStatus(start, end);

  const date = start.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const startTime = start.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

  const endTime = end.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <article className="glass relative overflow-hidden rounded-xl p-5 sm:p-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-[var(--accent)] opacity-[0.05] blur-3xl"
      />

      <div className="relative">
        <SessionStatus status={status} />
        <div className="mt-5">
          <h2 className="text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
            {session.name}
          </h2>

          {session.description && (
            <p className="mt-1.5 max-w-2xl text-sm text-[var(--muted)]">
              {session.description}
            </p>
          )}
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:max-w-3xl">
          <SessionDetail label="Date" value={date} />

          <SessionDetail label="Time" value={`${startTime} - ${endTime}`} />

          <SessionDetail
            label="Interview"
            value={`~${session.averageInterviewMinutes} min`}
            className="col-span-2 sm:col-span-1"
          />
        </div>
        <div className="mt-7 flex flex-col gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          {!entryLoaded ? (
            <>
              <p className="text-xs text-[var(--muted)]">
                Checking your queue status...
              </p>

              <button
                disabled
                className="flex w-full items-center justify-center rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--muted)] opacity-60 sm:w-auto"
              >
                Checking status...
              </button>
            </>
          ) : !entry ? (
            <>
              <div>
                <p className="text-xs font-medium">Ready for your interview?</p>
                <p className="mt-0.5 text-[0.7rem] text-[var(--muted)]">
                  Join when you're ready to enter the live queue.
                </p>
              </div>

              <button
                onClick={onJoin}
                disabled={joining || status === "ended"}
                className="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
              >
                {joining
                  ? "Joining..."
                  : status === "ended"
                    ? "Session ended"
                    : "Join queue"}
                {!joining && status !== "ended" && (
                  <span>
                    {" "}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      height="17px"
                      viewBox="0 -960 960 960"
                      width="17px"
                      fill="#090909"
                    >
                      <path d="m256-240-56-56 384-384H240v-80h480v480h-80v-344L256-240Z" />
                    </svg>
                  </span>
                )}
              </button>
            </>
          ) : entry.status === "completed" ? (
            <>
              <div>
                <p className="text-xs font-medium">Interview completed.</p>
                <p className="mt-0.5 text-[0.7rem] text-[var(--muted)]">
                  You're all done with this interview session.
                </p>
              </div>

              <span className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-5 py-2.5 text-sm font-medium text-emerald-500 sm:w-auto">
                <span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="17px"
                    viewBox="0 -960 960 960"
                    width="17px"
                    fill="#e3e3e3"
                  >
                    <path d="M389-267 195-460l51-52 143 143 325-324 51 51-376 375Z" />
                  </svg>
                </span>
                Completed
              </span>
            </>
          ) : entry.status === "skipped" ? (
            <>
              <div>
                <p className="text-xs font-medium">Interview closed.</p>
                <p className="mt-0.5 text-[0.7rem] text-[var(--muted)]">
                  Your interview team has closed this queue entry.
                </p>
              </div>

              <span className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-5 py-2.5 text-sm font-medium text-amber-500 sm:w-auto">
                Closed
              </span>
            </>
          ) : (
            <>
              <div>
                <p className="text-xs font-medium">
                  {entry.status === "waiting"
                    ? "You're checked in."
                    : entry.status === "next"
                      ? "You're up next."
                      : "Interview in progress."}
                </p>

                <p className="mt-0.5 text-[0.7rem] text-[var(--muted)]">
                  {entry.status === "waiting"
                    ? "Your place in the queue is secured."
                    : entry.status === "next"
                      ? "Stay ready — you'll be called shortly."
                      : "Your interview has started."}
                </p>
              </div>

              <button
                onClick={onReturn}
                className="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--foreground)] px-5 py-2.5 text-sm font-medium text-[var(--background)] transition-all hover:-translate-y-0.5 hover:opacity-90 active:translate-y-0 sm:w-auto"
              >
                Return to waiting hall
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="17px"
                  viewBox="0 -960 960 960"
                  width="17px"
                  fill="#090909"
                >
                  <path d="m256-240-56-56 384-384H240v-80h480v480h-80v-344L256-240Z" />
                </svg>
              </button>
            </>
          )}
        </div>{" "}
      </div>
    </article>
  );
}

type SessionStatusType = "live" | "upcoming" | "ended";

function getSessionStatus(start: Date, end: Date): SessionStatusType {
  const now = new Date();

  if (now < start) return "upcoming";
  if (now > end) return "ended";

  return "live";
}

function SessionStatus({ status }: { status: SessionStatusType }) {
  if (status === "live") {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--accent)] opacity-40" />
          <span className="relative inline-flex size-2 rounded-full bg-[var(--accent)]" />
        </span>

        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Live
        </span>
      </div>
    );
  }

  if (status === "upcoming") {
    return (
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full border border-[var(--accent)]" />

        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Upcoming
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="size-2 rounded-full bg-[var(--muted)] opacity-50" />

      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Ended
      </span>
    </div>
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

function EmptySessions() {
  return (
    <div className="glass flex min-h-72 flex-col items-center justify-center rounded-xl p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <span className="size-2 rounded-full bg-[var(--muted)] opacity-50" />
      </div>

      <h2 className="mt-5 text-xl font-semibold">No interview sessions</h2>

      <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
        There aren't any interview sessions available right now. When one opens,
        it'll appear here.
      </p>

      <div className="mt-5 flex items-center gap-2 text-xs text-[var(--muted)]">
        <span className="size-1.5 rounded-full bg-[var(--accent)]" />
        You're signed in and ready
      </div>
    </div>
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

function LoadingScreen() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex items-center gap-2.5">
        <span className="size-1.5 animate-pulse rounded-full bg-[var(--accent)]" />

        <p className="text-sm text-[var(--muted)]">Loading interviews...</p>
      </div>
    </main>
  );
}

function NotificationModal({
  onSkip,
  onEnable,
}: {
  onSkip: () => void;
  onEnable: () => Promise<void>;
}) {
  const [enabling, setEnabling] = useState(false);

  const handleEnable = async () => {
    try {
      setEnabling(true);
      await onEnable();
    } finally {
      setEnabling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--background)] shadow-2xl sm:rounded-xl"
      >
        <div className="border-b border-[var(--border)] px-5 py-5 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-[var(--accent)]" />
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--accent)]">
              Notifications
            </p>
          </div>

          <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em]">
            Stay updated
          </h2>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <p className="text-sm leading-6 text-[var(--muted)]">
            Lineup can notify you when you're next and when your interview is
            ready, so you don't have to keep watching the waiting hall.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            onClick={onSkip}
            disabled={enabling}
            className="cursor-pointer rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            Not now
          </button>

          <button
            onClick={handleEnable}
            disabled={enabling}
            className="cursor-pointer rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {enabling ? "Enabling..." : "Enable notifications"}
          </button>
        </div>
      </div>
    </div>
  );
}
