"use client";

import type { ShowRuntimeState } from "@trivia-live/game-engine";

interface ResultsViewProps {
  state: ShowRuntimeState;
  isEliminated: boolean;
  eliminatedAtQuestion: number | null;
}

export function ResultsView({
  state,
  isEliminated,
  eliminatedAtQuestion,
}: ResultsViewProps) {
  const totalPlayers = Object.keys(state.participants).length;
  const survivors = state.survivorCount;

  const headline = isEliminated ? "Better luck next time!" : "You survived!";
  const emoji = isEliminated ? "💀" : "🏆";

  return (
    <div className="live-section results-section">
      <p className="show-label live-phase-badge">
        {state.phase === "completed" ? "Show Complete" : "Results"}
      </p>

      <h1 className="title results-headline">
        {emoji} {headline}
      </h1>

      {isEliminated ? (
        <p className="subtitle">
          You were eliminated at question{" "}
          {eliminatedAtQuestion !== null ? eliminatedAtQuestion + 1 : "?"} of{" "}
          {state.questions.length}.
        </p>
      ) : (
        <p className="subtitle">
          You made it through all {state.questions.length} questions!
        </p>
      )}

      <div className="show-card live-stat-card">
        <div className="show-label">Final survivors</div>
        <div className="show-time live-stat-value">
          {survivors}
          <span className="results-of"> / {totalPlayers}</span>
        </div>
      </div>

      {!isEliminated && survivors > 1 && (
        <p className="subtitle results-share">
          You&apos;re one of {survivors} survivors — well played!
        </p>
      )}
      {!isEliminated && survivors === 1 && (
        <p className="subtitle results-share">
          Last one standing — perfect game! 🎉
        </p>
      )}
    </div>
  );
}
