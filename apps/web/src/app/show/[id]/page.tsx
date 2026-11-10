"use client";

import { use, useEffect, useState } from "react";
import { useShowChannel } from "@/hooks/useShowChannel";
import { useMyStatus } from "@/hooks/useMyStatus";
import {
  loadSession,
  saveSession,
  type JoinResult,
} from "@/lib/participantSession";
import { HostAudioStrip } from "@/components/HostAudioStrip";
import { Lobby } from "@/components/Lobby";
import { QuestionView } from "@/components/QuestionView";
import { SpectatorView } from "@/components/SpectatorView";
import { ResultsView } from "@/components/ResultsView";
import { RevealView } from "@/components/RevealView";

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

  // Our own status comes from the server (the broadcast state carries no
  // participant data). Re-fetch on every phase / question change.
  const { me } = useMyStatus(
    showId,
    session,
    state ? `${state.phase}:${state.questionIndex}` : "none",
  );

  const isEliminated = me?.eliminatedAtQuestion != null;
  // Late joiners watch only (they're not counted as players).
  const isSpectator = me?.spectator === true || session?.spectator === true;

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
          {isEliminated || isSpectator ? (
            <SpectatorView state={state} lateJoiner={isSpectator} />
          ) : (
            <QuestionView
              state={state}
              showId={showId}
              session={session}
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
          <RevealView state={state} me={me} isSpectator={isSpectator} />
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
            isSpectator={isSpectator}
            showId={showId}
            pointsEarned={me?.pointsEarned ?? null}
            eliminatedAtQuestion={
              me?.eliminatedAtQuestion ?? null
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
