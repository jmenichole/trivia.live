"use client";

import type { PublicShowState } from "@trivia-live/game-engine";

interface LobbyProps {
  state: PublicShowState;
  /** Extra-life card etc., rendered under the player count. */
  children?: React.ReactNode;
}

export function Lobby({ state, children }: LobbyProps) {
  return (
    <div className="live-section">
      <p className="show-label live-phase-badge">Lobby</p>
      <h1 className="title">Get Ready!</h1>
      <p className="subtitle">The show is about to begin. Stay on this page.</p>

      <div className="show-card live-stat-card">
        <div className="show-label">Players waiting</div>
        <div className="show-time live-stat-value">{state.playerCount}</div>
      </div>

      {children}

      <div className="live-pulse-row">
        <span className="live-dot" aria-hidden="true" />
        <span className="countdown">Waiting for host to start…</span>
      </div>
    </div>
  );
}
