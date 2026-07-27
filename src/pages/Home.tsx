import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { useNavigate } from "react-router-dom";

import {
  loginWithGoogle,
  subscribeToAuth,
  isAdmin,
} from "../services/auth.service";

const steps = [
  {
    number: "01",
    title: "Join the queue",
    description:
      "Choose your interview session and enter the queue when you're ready.",
  },
  {
    number: "02",
    title: "Stay ready",
    description:
      "Keep Lineup open. Your position and status update automatically.",
  },
  {
    number: "03",
    title: "Get called",
    description:
      "When it's your turn, your status changes and the Meet link appears.",
  },
];

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (currentUser: User | null) => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const admin = await isAdmin(currentUser.uid);

        navigate(admin ? "/admin" : "/user", { replace: true });
      } catch (error) {
        console.error("Failed to determine user role:", error);

        setLoading(false);
      }
    });

    return unsubscribe;
  }, [navigate]);

  const handleLogin = async () => {
    try {
      setLoggingIn(true);

      await loginWithGoogle();

      // No navigate() here.
      // onAuthStateChanged above handles it.
    } catch (error) {
      console.error("Login failed:", error);
      setLoggingIn(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <main className="min-h-dvh bg-[var(--background)] px-5 text-[var(--foreground)] sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-dvh max-w-7xl flex-col">
        <Navbar />

        {/* Main */}
        <div className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-12">
          {/* Hero */}
          <section className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-sm border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted)] backdrop-blur-xl sm:mb-6">
              <span className="size-1.5 rounded-full bg-[var(--accent)]" />
              Live interview queues
            </div>

            <h1 className="text-[2rem] font-semibold leading-[1.03] tracking-[-0.045em] sm:text-6xl lg:text-5xl">
              Interviews without the{" "}
              <span className="text-[var(--accent)]">waiting game</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-[var(--muted)] sm:mt-6 sm:text-md">
              Join your interview queue, track your status live, and know
              exactly when it's your turn
            </p>

            <div className="mt-7 sm:mt-8">
              <button
                onClick={handleLogin}
                disabled={loggingIn}
                className="flex w-full max-w-sm cursor-pointer items-center justify-center gap-3 rounded-lg bg-[var(--foreground)] px-5 py-3.5 font-medium text-[var(--background)] transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 disabled:pointer-events-none disabled:opacity-50 sm:w-auto sm:min-w-64"
              >
                <GoogleIcon />

                {loggingIn ? "Signing in..." : "Continue with Google"}
              </button>

              <p className="mt-4 text-xs text-[var(--muted)]">
                Your queue updates automatically. No refreshing required
              </p>
            </div>
          </section>

          <BentoSteps />
        </div>

        <footer className="flex h-14 shrink-0 items-center justify-between border-t border-[var(--border)] text-xs text-[var(--muted)] sm:h-16">
          <span>Lineup</span>
          <span>Live interview queues.</span>
        </footer>
      </div>
    </main>
  );
}

function BentoSteps() {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      {/* 01 */}
      <article className="glass flex min-h-56 flex-col justify-between rounded-xl p-5 sm:row-span-2 sm:min-h-72 sm:p-7 lg:min-h-80">
        <div>
          <span className="text-xs font-medium tracking-[0.16em] text-[var(--muted)]">
            {steps[0].number}
          </span>

          <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] sm:mt-7 sm:text-3xl">
            {steps[0].title}
          </h2>
        </div>

        <div className="mt-10">
          <div className="mb-4 h-1 w-10 rounded-full bg-[var(--accent)]" />

          <p className="max-w-xs text-sm leading-6 text-[var(--muted)]">
            {steps[0].description}
          </p>
        </div>
      </article>

      {/* 02 */}
      <article className="glass flex min-h-40 flex-col justify-between rounded-xl p-5 sm:min-h-0 sm:p-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium tracking-[0.16em] text-[var(--muted)]">
            {steps[1].number}
          </span>

          <span className="size-1.5 rounded-full bg-[var(--muted)] opacity-50" />
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold tracking-[-0.025em]">
            {steps[1].title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {steps[1].description}
          </p>
        </div>
      </article>

      {/* 03 */}
      <article className="glass relative flex min-h-40 flex-col justify-between overflow-hidden rounded-xl p-5 sm:min-h-0 sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -right-16 size-40 rounded-full bg-[var(--accent)] opacity-10 blur-3xl"
        />

        <div className="relative flex items-center justify-between">
          <span className="text-xs font-medium tracking-[0.16em] text-[var(--muted)]">
            {steps[2].number}
          </span>

          <span className="size-2 rounded-full bg-[var(--accent)]" />
        </div>

        <div className="relative mt-8">
          <h2 className="text-xl font-semibold tracking-[-0.025em] text-[var(--accent)]">
            {steps[2].title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {steps[2].description}
          </p>
        </div>
      </article>
    </section>
  );
}

function Navbar() {
  return (
    <nav className="flex h-16 shrink-0 items-center justify-between sm:h-20">
      <Logo />
    </nav>
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

        <p className="text-sm text-[var(--muted)]">Loading Lineup...</p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.98h5.38c-.46 2.39-2.5 3.98-5.38 3.98a6.06 6.06 0 1 1 0-12.12c1.55 0 2.94.53 4.04 1.57l2.26-2.26C16.58 3.65 14.42 2.7 12 2.7a9.3 9.3 0 1 0 0 18.6c5.37 0 8.93-3.77 8.93-9.08 0-.61-.07-.88-.16-1.12h-.42Z"
      />
    </svg>
  );
}
