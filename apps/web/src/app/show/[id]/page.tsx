"use client";

import { use, useEffect, useState } from "react";
import { participantKey } from "@trivia-live/game-engine";
import { useShowChannel } from "@/hooks/useShowChannel";
import { HostAudioStrip } from "@/components/HostAudioStrip";
import { Lobby } from "@/components/Lobby";
import { QuestionView } from "@/components/QuestionView";
import { SpectatorView } from "@/components/SpectatorView";
import { ResultsView } from "@/components/ResultsView";

interface JoinResult {
  participantId: string;
  guestToken: string;
}

function storageKey(showId: string) {
  return `show-participant:${showId}`;
}

function loadSession(showId: string): JoinResult | null {
  try {
    const raw = sessionStorage.getItem(storageKey(showId));
    return raw ? (JSON.parse(raw) as JoinResult) : null;
  } catch {
    return null;
  }
}

function saveSession(showId: string, data: JoinResult) {
  try {
    sessionStorage.setItem(storageKey(showId), JSON.stringify(data));
  } catch {
    // sessionStorage unavailable (private browsing edge case).
  }
}

export default function ShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: showId } = use(params);

  const [session, setSession] = useState<JoinResult | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const { state, hostMode, error: channelError } = useShowChannel(showId);

  const hostAudioStrip =
    hostMode === "live_audio" && session?.participantId ? (
      <HostAudioStrip
        showId={showId}
        participantId={session.participantId}
      />
    ) : null;

  // Join (or restore) on mount.
  useEffect(() => {
    const existing = loadSession(showId);
    if (existing) {
      setSession(existing);
      return;
    }

    fetch(`/api/shows/${showId}/join`, { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? "Failed to join show",
          );
        }
        return res.json() as Promise<JoinResult>;
      })
      .then((data) => {
        saveSession(showId, data);
        setSession(data);
      })
      .catch((err: unknown) => {
        setJoinError(err instanceof Error ? err.message : "Unknown error");
      });
  }, [showId]);

  // Determine if this participant has been eliminated.
  const myKey =
    session?.guestToken != null
      ? participantKey({ playerId: null, guestToken: session.guestToken })
      : null;

  const participantState =
    myKey && state ? state.participants[myKey] : undefined;

  const isEliminated =
    participantState?.eliminatedAtQuestion !== null &&
    participantState?.eliminatedAtQuestion !== undefined;

  // ── Render ────────────────────────────────────────────────────────────────

  if (joinError) {
    return (
      <main>
        <h1 className="title">Unable to join</h1>
        <p className="subtitle">{joinError}</p>
      </main>
    );
  }

  if (channelError) {
    return (
      <main>
        <h1 className="title">Connection error</h1>
        <p className="subtitle">{channelError}</p>
      </main>
    );
  }

  if (!session || !state) {
    return (
      <>
        <main>
          <p className="subtitle">Connecting…</p>
        </main>
        {hostAudioStrip}
      </>
    );
  }

  const { phase } = state;

  if (phase === "cancelled") {
    return (
      <>
        <main>
          <h1 className="title">Show Cancelled</h1>
          <p className="subtitle">This show was cancelled. Check back soon.</p>
        </main>
        {hostAudioStrip}
      </>
    );
  }

  if (phase === "scheduled" || phase === "lobby") {
    return (
      <>
        <main>
          <Lobby state={state} />
        </main>
        {hostAudioStrip}
      </>
    );
  }

  if (phase === "question") {
    return (
      <>
        <main>
          {isEliminated ? (
            <SpectatorView state={state} />
          ) : (
            <QuestionView
              state={state}
              showId={showId}
              participantId={session.participantId}
            />
          )}
        </main>
        {hostAudioStrip}
      </>
    );
  }

  if (phase === "reveal") {
    return (
      <>
        <main>
          <div className="live-section">
            <p className="show-label live-phase-badge">Reveal</p>
            <h2 className="question-body">
              {state.questions[state.questionIndex]?.body}
            </h2>
            <p className="subtitle">Results incoming…</p>
            <div className="show-card live-stat-card">
              <div className="show-label">Survivors</div>
              <div className="show-time live-stat-value">
                {state.survivorCount}
              </div>
            </div>
          </div>
        </main>
        {hostAudioStrip}
      </>
    );
  }

  if (phase === "results" || phase === "completed") {
    return (
      <>
        <main>
          <ResultsView
            state={state}
            isEliminated={isEliminated}
            eliminatedAtQuestion={
              participantState?.eliminatedAtQuestion ?? null
            }
          />
        </main>
        {hostAudioStrip}
      </>
    );
  }

  return (
    <>
      <main>
        <p className="subtitle">Loading show…</p>
      </main>
      {hostAudioStrip}
    </>
  );
}
