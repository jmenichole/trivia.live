"use client";

import { useEffect, useRef, useState } from "react";
import { Room } from "livekit-client";
import type { ShowRuntimeState } from "@trivia-live/game-engine";

export function HostConsole({
  showId,
  state,
}: {
  showId: string;
  state: ShowRuntimeState | null;
}) {
  const roomRef = useRef<Room | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function goLive() {
    setError(null);
    const res = await fetch(
      `/api/livekit/token?showId=${showId}&role=host`,
    );
    if (!res.ok) {
      setError("Could not connect to LiveKit");
      return;
    }
    const { token, url } = await res.json();
    const room = new Room();
    await room.connect(url, token);
    await room.localParticipant.setMicrophoneEnabled(true);
    roomRef.current = room;
    setLive(true);
  }

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
    };
  }, []);

  const q =
    state && state.questionIndex >= 0
      ? state.questions[state.questionIndex]
      : null;

  return (
    <div className="host-console">
      <h1>Host Console</h1>
      <p className="host-phase">Phase: {state?.phase ?? "loading…"}</p>
      {!live ? (
        <button className="btn" onClick={goLive}>
          Go live (enable mic)
        </button>
      ) : (
        <span className="host-live-badge">● LIVE</span>
      )}
      {error && <p className="host-error">{error}</p>}
      {q && (
        <div className="host-script">
          <h2>Read aloud:</h2>
          <p>{q.body}</p>
          <ul>
            {q.choices.map((c) => (
              <li key={c.id}>{c.text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
