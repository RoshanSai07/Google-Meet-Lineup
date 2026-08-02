import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "firebase/auth";

import {
  createSession,
  getActiveSessions,
  updateSession,
  updateSessionStatus,
} from "../services/session.service";

import {
  logout,
  subscribeToAuth,
  isAdmin,
  isSuperAdmin,
} from "../services/auth.service";

import type { SessionStatus, InterviewSession } from "../types/session";

export default function Admin() {
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [superAdmin, setSuperAdmin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<InterviewSession | null>(
    null,
  );

  /*
   * Protect admin page + load sessions
   */
  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (currentUser) => {
      if (!currentUser) {
        navigate("/", { replace: true });
        return;
      }

      try {
        const admin = await isAdmin(currentUser.uid);

        if (!admin) {
          navigate("/user", { replace: true });
          return;
        }

        const superAdmin = await isSuperAdmin(currentUser.uid);

        setSuperAdmin(superAdmin);

        setUser(currentUser);

        const activeSessions = await getActiveSessions();
        setSessions(activeSessions);
      } catch (error) {
        console.error("Failed to load admin:", error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const refreshSessions = async () => {
    const activeSessions = await getActiveSessions();
    setSessions(activeSessions);
  };

  if (loading || !user) {
    return <LoadingScreen />;
  }

  return (
    <main className="min-h-dvh bg-[var(--background)] px-5 text-[var(--foreground)] sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-dvh max-w-7xl flex-col">
        {/* Navbar */}
        <nav className="flex h-16 shrink-0 items-center justify-between sm:h-20">
          <div className="flex items-center gap-3">
            <Logo />

            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-[var(--border-strong)]">/</span>

              <span className="text-sm text-[var(--muted)]">Admin</span>
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
              onClick={handleLogout}
              className="cursor-pointer rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            >
              Sign out
            </button>
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 py-8 sm:py-12">
          {/* Header */}
          <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-[var(--accent)]" />

                <span className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
                  Admin dashboard
                </span>
              </div>

              <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                Interview sessions
              </h1>

              <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
                Create sessions and manage your interview queues.
              </p>
            </div>

            {superAdmin && (
              <button
                onClick={() => setCreateOpen(true)}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] active:translate-y-0"
              >
                <span className="text-lg leading-none">+</span>
                New session
              </button>
            )}
          </header>

          {/* Sessions */}
          <section className="mt-8">
            {sessions.length === 0 ? (
              <EmptySessions
                superAdmin={superAdmin}
                onCreate={() => setCreateOpen(true)}
              />
            ) : (
              <div className="grid gap-4">
                {sessions.map((session) => (
                  <AdminSessionCard
                    key={session.id}
                    session={session}
                    superAdmin={superAdmin}
                    onManage={() => navigate(`/session/${session.id}`)}
                    onEdit={() => setEditingSession(session)}
                    onStatusChanged={refreshSessions}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="flex h-14 shrink-0 items-center justify-between border-t border-[var(--border)] text-xs text-[var(--muted)] sm:h-16">
          <span>Lineup</span>
          <span>Admin dashboard</span>
        </footer>
      </div>

      {/* Create Session Modal */}
      {superAdmin && createOpen && (
        <CreateSessionModal
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await refreshSessions();
          }}
        />
      )}
      {superAdmin && editingSession && (
        <EditSessionModal
          session={editingSession}
          onClose={() => setEditingSession(null)}
          onUpdated={async () => {
            setEditingSession(null);
            await refreshSessions();
          }}
        />
      )}
    </main>
  );
}
interface AdminSessionCardProps {
  session: InterviewSession;
  superAdmin: boolean;
  onManage: () => void;
  onEdit: () => void;
  onStatusChanged: () => Promise<void>;
}

function AdminSessionCard({
  session,
  superAdmin,
  onManage,
  onEdit,
  onStatusChanged,
}: AdminSessionCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const start = session.startsAt.toDate();
  const end = session.endsAt.toDate();
  const scheduleStatus = getScheduleStatus(start, end);

  // const displayStatus =
  //   session.status === "closed"
  //     ? "closed"
  //     : session.status === "paused"
  //       ? "paused"
  //       : scheduleStatus;

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

  const handleStatusChange = async (status: SessionStatus) => {
    try {
      setUpdatingStatus(true);
      setMenuOpen(false);

      await updateSessionStatus(session.id, status);
      await onStatusChanged();
    } catch (error) {
      console.error("Failed to update session status:", error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <article className="glass relative overflow-hidden rounded-xl p-5 sm:p-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-[var(--accent)] opacity-[0.05] blur-3xl"
      />

      <div className="relative">
        <AdminSessionStatus
          sessionStatus={session.status}
          scheduleStatus={scheduleStatus}
        />

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
          <p className="text-xs text-[var(--muted)]">
            {session.status === "closed"
              ? "This session has been closed."
              : session.status === "paused"
                ? "Queue is temporarily paused."
                : scheduleStatus === "ended"
                  ? "The scheduled interview window has ended."
                  : scheduleStatus === "upcoming"
                    ? "Session is scheduled and waiting to begin."
                    : "Queue is available to signed-in candidates."}
          </p>

          <div className="flex gap-2">
            <button
              onClick={onManage}
              className={`group flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 sm:flex-none ${
                session.status === "closed"
                  ? "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                  : "bg-[var(--foreground)] text-[var(--background)] hover:opacity-90"
              }`}
            >
              <span className="transition-all duration-300 ease-out">
                {session.status === "closed"
                  ? "View session"
                  : session.status === "paused"
                    ? "View queue"
                    : scheduleStatus === "ended"
                      ? "View session"
                      : scheduleStatus === "upcoming"
                        ? "View queue"
                        : "Manage queue"}
              </span>

              <span className="transition-transform duration-300 ease-out">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="17px"
                  viewBox="0 -960 960 960"
                  width="17px"
                  fill="currentColor"
                >
                  <path d="m256-240-56-56 384-384H240v-80h480v480h-80v-344L256-240Z" />
                </svg>
              </span>
            </button>

            {superAdmin && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((current) => !current)}
                  disabled={updatingStatus}
                  aria-label="Session actions"
                  aria-expanded={menuOpen}
                  className="flex size-10 cursor-pointer items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  •••
                </button>

                {menuOpen && (
                  <div className="absolute bottom-12 right-0 z-20 min-w-44 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] p-1.5 shadow-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onEdit();
                      }}
                      className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      Edit session
                    </button>

                    <div className="my-1 border-t border-[var(--border)]" />

                    {session.status === "open" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange("paused")}
                        className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-hover)]"
                      >
                        Pause session
                      </button>
                    )}

                    {session.status === "paused" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange("open")}
                        className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-hover)]"
                      >
                        Resume session
                      </button>
                    )}

                    {session.status !== "closed" && (
                      <>
                        <div className="my-1 border-t border-[var(--border)]" />

                        <button
                          type="button"
                          onClick={() => handleStatusChange("closed")}
                          className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm text-red-500 transition-colors hover:bg-red-500/5"
                        >
                          Close session
                        </button>
                      </>
                    )}

                    {session.status === "closed" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange("open")}
                        className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-hover)]"
                      >
                        Reopen session
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
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

function EmptySessions({
  superAdmin,
  onCreate,
}: {
  superAdmin: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="glass flex min-h-72 flex-col items-center justify-center rounded-xl p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <span className="text-xl text-[var(--muted)]">+</span>
      </div>

      <h2 className="mt-5 text-xl font-semibold">No active sessions</h2>

      <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
        Create an interview session to start accepting candidates into a queue.
      </p>

      {superAdmin && (
        <button
          onClick={onCreate}
          className="mt-6 cursor-pointer rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
        >
          Create your first session
        </button>
      )}
    </div>
  );
}

interface CreateSessionModalProps {
  onClose: () => void;
  onCreated: () => Promise<void>;
}

function CreateSessionModal({ onClose, onCreated }: CreateSessionModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [meetUrl, setMeetUrl] = useState("");

  const [averageMinutes, setAverageMinutes] = useState(8);

  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    if (!name.trim() || !startsAt || !endsAt) {
      setError("Fill in the required fields.");
      return;
    }

    const start = new Date(startsAt);
    const end = new Date(endsAt);

    if (end <= start) {
      setError("End time must be after the start time.");
      return;
    }

    if (averageMinutes < 1) {
      setError("Interview duration must be at least 1 minute.");
      return;
    }

    try {
      setCreating(true);

      await createSession({
        name: name.trim(),
        description: description.trim(),
        meetUrl: meetUrl.trim(),
        averageInterviewMinutes: averageMinutes,
        startsAt: start,
        endsAt: end,
      });

      await onCreated();
    } catch (error) {
      console.error("Failed to create session:", error);

      setError("Something went wrong while creating the session.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-session-title"
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--background)] shadow-2xl sm:rounded-xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[var(--border)] bg-[var(--background)] px-5 py-5 sm:px-7">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--accent)]">
              New session
            </p>

            <h2
              id="create-session-title"
              className="mt-1 text-xl font-semibold tracking-[-0.03em]"
            >
              Create interview session
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            aria-label="Close"
            className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--border)] text-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleCreate}>
          <div className="space-y-6 p-5 sm:p-7">
            {/* Basics */}
            <FormSection
              title="Session details"
              description="The information candidates will see before joining."
            >
              <Field label="Session name" required>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="CodeCrux Recruitment 2026"
                  required
                  className={inputClass}
                />
              </Field>

              <Field label="Description">
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="CodeCrux recruitment interviews"
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </Field>
            </FormSection>

            {/* Interview */}
            <FormSection
              title="Interview"
              description="Configure the meeting and expected duration."
            >
              <Field label="Google Meet URL">
                <input
                  type="url"
                  value={meetUrl}
                  onChange={(event) => setMeetUrl(event.target.value)}
                  placeholder="https://meet.google.com/..."
                  className={inputClass}
                />
              </Field>

              <Field
                label="Expected interview duration"
                hint="Used to estimate candidate wait times."
              >
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={averageMinutes}
                    onChange={(event) =>
                      setAverageMinutes(Number(event.target.value))
                    }
                    className={`${inputClass} pr-16`}
                  />

                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)]">
                    min
                  </span>
                </div>
              </Field>
            </FormSection>

            <FormSection
              title="Schedule"
              description="Set when candidates can expect interviews to run."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Starts at" required>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(event) => setStartsAt(event.target.value)}
                    required
                    className={inputClass}
                  />
                </Field>

                <Field label="Ends at" required>
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(event) => setEndsAt(event.target.value)}
                    required
                    className={inputClass}
                  />
                </Field>
              </div>
            </FormSection>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500"
              >
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[var(--border)] bg-[var(--background)] px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="cursor-pointer rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={creating}
              className="cursor-pointer rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating session..." : "Create session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditSessionModalProps {
  session: InterviewSession;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}

function EditSessionModal({
  session,
  onClose,
  onUpdated,
}: EditSessionModalProps) {
  const [name, setName] = useState(session.name);
  const [description, setDescription] = useState(session.description ?? "");
  const [meetUrl, setMeetUrl] = useState(session.meetUrl ?? "");

  const [averageMinutes, setAverageMinutes] = useState(
    session.averageInterviewMinutes,
  );

  const [startsAt, setStartsAt] = useState(
    toDateTimeLocalValue(session.startsAt.toDate()),
  );

  const [endsAt, setEndsAt] = useState(
    toDateTimeLocalValue(session.endsAt.toDate()),
  );

  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    if (!name.trim() || !startsAt || !endsAt) {
      setError("Fill in the required fields.");
      return;
    }

    const start = new Date(startsAt);
    const end = new Date(endsAt);

    if (end <= start) {
      setError("End time must be after the start time.");
      return;
    }

    if (averageMinutes < 1) {
      setError("Interview duration must be at least 1 minute.");
      return;
    }

    try {
      setUpdating(true);

      await updateSession(session.id, {
        name: name.trim(),
        description: description.trim(),
        meetUrl: meetUrl.trim(),
        averageInterviewMinutes: averageMinutes,
        startsAt: start,
        endsAt: end,
      });

      await onUpdated();
    } catch (error) {
      console.error("Failed to update session:", error);

      setError("Something went wrong while updating the session.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !updating) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-session-title"
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--background)] shadow-2xl sm:rounded-xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[var(--border)] bg-[var(--background)] px-5 py-5 sm:px-7">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--accent)]">
              Session settings
            </p>

            <h2
              id="edit-session-title"
              className="mt-1 text-xl font-semibold tracking-[-0.03em]"
            >
              Edit interview session
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={updating}
            aria-label="Close"
            className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--border)] text-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleUpdate}>
          <div className="space-y-6 p-5 sm:p-7">
            <FormSection
              title="Session details"
              description="Update the information candidates see."
            >
              <Field label="Session name" required>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  className={inputClass}
                />
              </Field>

              <Field label="Description">
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </Field>
            </FormSection>

            <FormSection
              title="Interview"
              description="Update the meeting and expected duration."
            >
              <Field label="Google Meet URL">
                <input
                  type="url"
                  value={meetUrl}
                  onChange={(event) => setMeetUrl(event.target.value)}
                  placeholder="https://meet.google.com/..."
                  className={inputClass}
                />
              </Field>

              <Field
                label="Expected interview duration"
                hint="Used to estimate candidate wait times."
              >
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={averageMinutes}
                    onChange={(event) =>
                      setAverageMinutes(Number(event.target.value))
                    }
                    className={`${inputClass} pr-16`}
                  />

                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)]">
                    min
                  </span>
                </div>
              </Field>
            </FormSection>

            <FormSection
              title="Schedule"
              description="Change when candidates can expect interviews to run."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Starts at" required>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(event) => setStartsAt(event.target.value)}
                    required
                    className={inputClass}
                  />
                </Field>

                <Field label="Ends at" required>
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(event) => setEndsAt(event.target.value)}
                    required
                    className={inputClass}
                  />
                </Field>
              </div>
            </FormSection>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500"
              >
                {error}
              </div>
            )}
          </div>

          <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[var(--border)] bg-[var(--background)] px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <button
              type="button"
              onClick={onClose}
              disabled={updating}
              className="cursor-pointer rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={updating}
              className="cursor-pointer rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updating ? "Saving changes..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function toDateTimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const inputClass = `w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)]`;

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>

        <p className="mt-1 text-xs text-[var(--muted)]">{description}</p>
      </div>

      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium">
        {label}

        {required && <span className="ml-1 text-[var(--accent)]">*</span>}
      </span>

      {children}

      {hint && (
        <span className="mt-1.5 block text-[0.7rem] text-[var(--muted)]">
          {hint}
        </span>
      )}
    </label>
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

        <p className="text-sm text-[var(--muted)]">Loading dashboard...</p>
      </div>
    </main>
  );
}

type ScheduleStatus = "upcoming" | "live" | "ended";

function getScheduleStatus(start: Date, end: Date): ScheduleStatus {
  const now = new Date();

  if (now < start) return "upcoming";
  if (now > end) return "ended";

  return "live";
}

function AdminSessionStatus({
  sessionStatus,
  scheduleStatus,
}: {
  sessionStatus: SessionStatus;
  scheduleStatus: ScheduleStatus;
}) {
  if (sessionStatus === "closed") {
    return (
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-[var(--muted)] opacity-50" />

        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Closed
        </span>
      </div>
    );
  }

  if (sessionStatus === "paused") {
    return (
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-amber-500" />

        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-500">
          Paused
        </span>
      </div>
    );
  }

  if (scheduleStatus === "upcoming") {
    return (
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full border border-[var(--accent)]" />

        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Upcoming
        </span>
      </div>
    );
  }

  if (scheduleStatus === "ended") {
    return (
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-[var(--muted)] opacity-50" />

        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Ended
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-40" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>

      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-500">
        Live
      </span>
    </div>
  );
}
