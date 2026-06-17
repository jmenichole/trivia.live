"use client";

import { useEffect, useRef, useState } from "react";
import type { ShowRuntimeState } from "@trivia-live/game-engine";

const QUESTION_DURATION_MS = 10_000;

interface QuestionViewProps {
  state: ShowRuntimeState;
  showId: string;
  participantId: string;
}

export function QuestionView({
  state,
  showId,
  participantId,
}: QuestionViewProps) {
  const question = state.questions[state.questionIndex];
  const [answered, setAnswered] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_DURATION_MS);
  const phaseStartRef = useRef(new Date(state.phaseStartedAt).getTime());

  // Reset whenever the question changes.
  useEffect(() => {
    phaseStartRef.current = new Date(state.phaseStartedAt).getTime();
    const elapsed = Date.now() - phaseStartRef.current;
    setTimeLeft(Math.max(0, QUESTION_DURATION_MS - elapsed));
    setAnswered(false);
    setSelectedChoice(null);
  }, [state.questionIndex, state.phaseStartedAt]);

  // Tick the timer.
  useEffect(() => {
    const id = window.setInterval(() => {
      const elapsed = Date.now() - phaseStartRef.current;
      setTimeLeft(Math.max(0, QUESTION_DURATION_MS - elapsed));
    }, 100);
    return () => window.clearInterval(id);
  }, [state.questionIndex]);

  async function handleAnswer(choiceId: string) {
    if (answered || timeLeft === 0) return;
    setAnswered(true);
    setSelectedChoice(choiceId);

    try {
      await fetch(`/api/shows/${showId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId,
          questionIndex: state.questionIndex,
          choiceId,
        }),
      });
    } catch {
      // Answer already recorded locally; network error is non-fatal here.
    }
  }

  if (!question) return null;

  const pct = (timeLeft / QUESTION_DURATION_MS) * 100;
  const timerColor =
    pct > 50 ? "var(--accent)" : pct > 25 ? "#d97706" : "#dc2626";

  return (
    <div className="live-section">
      <div className="question-meta">
        <span className="show-label">
          Question {state.questionIndex + 1} / {state.questions.length}
        </span>
        <span className="show-label">{question.category}</span>
      </div>

      <div className="timer-bar-wrap" role="progressbar" aria-valuenow={pct}>
        <div
          className="timer-bar"
          style={{ width: `${pct}%`, background: timerColor }}
        />
      </div>
      <p className="timer-label">{(timeLeft / 1000).toFixed(1)}s</p>

      <h2 className="question-body">{question.body}</h2>

      <div className="choices">
        {question.choices.map((choice) => {
          const isSelected = selectedChoice === choice.id;
          return (
            <button
              key={choice.id}
              className={[
                "choice-btn",
                isSelected ? "choice-selected" : "",
                answered ? "choice-locked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => handleAnswer(choice.id)}
              disabled={answered || timeLeft === 0}
            >
              {choice.text}
            </button>
          );
        })}
      </div>

      {answered && (
        <p className="answered-msg">
          ✓ Answer submitted — hang tight for the reveal!
        </p>
      )}
      {!answered && timeLeft === 0 && (
        <p className="answered-msg timed-out">Time&apos;s up!</p>
      )}
    </div>
  );
}
