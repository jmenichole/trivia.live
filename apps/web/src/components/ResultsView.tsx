"use client";

import type { PublicShowState } from "@trivia-live/game-engine";

interface ResultsViewProps {
  state: PublicShowState;
  isEliminated: boolean;
  isSpectator?: boolean;
  /** 1-based question number the player was knocked out on. */
  eliminatedAtQuestion: number | null;
}

export function ResultsView({
  state,
  isEliminated,
  isSpectator = false,
  eliminatedAtQuestion,
}: ResultsViewProps) {
  const totalPlayers = state.playerCount;
  const survivors = state.survivorCount;

  const headline = isSpectator
    ? "Thanks for watching!"
    : isEliminated
      ? "Better luck next time!"
      : "You survived!";
  const emoji = isSpectator ? "👀" : isEliminated ? "💀" : "🏆";

  return (
    <div className="live-section results-section">
      <p className="show-label live-phase-badge">
        {state.phase === "completed" ? "Show Complete" : "Results"}
      </p>

      <h1 className="title results-headline">
        {emoji} {headline}
      </h1>

      {isSpectator ? (
        <p className="subtitle">
          You joined after the show started. Join the next lobby before the
          first question to play.
        </p>
      ) : isEliminated ? (
        <p className="subtitle">
          You were knocked out on question{" "}
          {eliminatedAtQuestion ?? "?"} of {state.totalQuestions}.
        </p>
      ) : (
        <p className="subtitle">
          You made it through all {state.totalQuestions} questions!
        </p>
      )}

      <div className="show-card live-stat-card">
        <div className="show-label">Final survivors</div>
        <div className="show-time live-stat-value">
          {survivors}
          <span className="results-of"> / {totalPlayers}</span>
        </div>
      </div>

      {!isSpectator && !isEliminated && survivors > 1 && (
        <p className="subtitle results-share">
          You&apos;re one of {survivors} survivors — well played!
        </p>
      )}
      {!isSpectator && !isEliminated && survivors === 1 && (
        <p className="subtitle results-share">
          Last one standing — perfect game! 🎉
        </p>
      )}
    </div>
  );
}
