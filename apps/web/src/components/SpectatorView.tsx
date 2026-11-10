"use client";

import type { PublicShowState } from "@trivia-live/game-engine";

interface SpectatorViewProps {
  state: PublicShowState;
  /** Joined after the show started (vs. knocked out). */
  lateJoiner?: boolean;
}

export function SpectatorView({ state, lateJoiner = false }: SpectatorViewProps) {
  const question = state.currentQuestion;

  if (!question) return null;

  return (
    <div className="live-section">
      <p className="show-label spectator-badge">👁 Spectator Mode</p>

      <div className="question-meta">
        <span className="show-label">
          Question {state.questionIndex + 1} / {state.totalQuestions}
        </span>
        <span className="show-label">{question.category}</span>
      </div>

      <h2 className="question-body">{question.body}</h2>

      <div className="choices">
        {question.choices.map((choice) => (
          <div key={choice.id} className="choice-btn choice-locked spectator-choice">
            {choice.text}
          </div>
        ))}
      </div>

      <p className="subtitle spectator-info">
        {state.survivorCount} player{state.survivorCount !== 1 ? "s" : ""} still
        competing —{" "}
        {lateJoiner
          ? "you joined after the show started, so you're watching this one. Catch the next show from the lobby!"
          : "you can't answer after being eliminated."}
      </p>
    </div>
  );
}
