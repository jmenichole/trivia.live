"use client";

import type { ShowRuntimeState } from "@trivia-live/game-engine";

interface SpectatorViewProps {
  state: ShowRuntimeState;
}

export function SpectatorView({ state }: SpectatorViewProps) {
  const question = state.questions[state.questionIndex];

  if (!question) return null;

  return (
    <div className="live-section">
      <p className="show-label spectator-badge">👁 Spectator Mode</p>

      <div className="question-meta">
        <span className="show-label">
          Question {state.questionIndex + 1} / {state.questions.length}
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
        competing — you can&apos;t answer after being eliminated.
      </p>
    </div>
  );
}
