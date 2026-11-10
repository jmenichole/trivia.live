"use client";

import type { PublicShowState } from "@trivia-live/game-engine";
import type { MyStatus } from "@/hooks/useMyStatus";

interface RevealViewProps {
  state: PublicShowState;
  me: MyStatus | null;
  isSpectator: boolean;
}

export function RevealView({ state, me, isSpectator }: RevealViewProps) {
  const question = state.currentQuestion;
  if (!question) return null;

  const questionNumber = state.questionIndex + 1;
  const mine =
    me?.lastAnswer && me.lastAnswer.questionIndex === state.questionIndex
      ? me.lastAnswer
      : null;
  const knockedOutHere = me?.eliminatedAtQuestion === questionNumber;
  const knockedOutEarlier =
    me?.eliminatedAtQuestion != null && me.eliminatedAtQuestion < questionNumber;
  const savedByLife = me?.extraLifeUsedAtQuestion === questionNumber;

  let verdict: { text: string; tone: "good" | "bad" | "neutral" };
  if (isSpectator) {
    verdict = { text: "You're watching this show", tone: "neutral" };
  } else if (!me) {
    verdict = { text: "Checking your answer…", tone: "neutral" };
  } else if (knockedOutEarlier) {
    verdict = { text: "You're spectating", tone: "neutral" };
  } else if (savedByLife) {
    verdict = { text: "❤️ Extra life used — you're still in!", tone: "good" };
  } else if (knockedOutHere) {
    verdict = {
      text: mine ? "✗ Wrong answer — you're out" : "⏱ No answer — you're out",
      tone: "bad",
    };
  } else if (mine?.correct) {
    verdict = { text: "✓ Correct — you're still in!", tone: "good" };
  } else {
    verdict = { text: "You're still in!", tone: "good" };
  }

  return (
    <div className="live-section">
      <div className="question-meta">
        <span className="show-label live-phase-badge">Reveal</span>
        <span className="show-label">
          Question {questionNumber} / {state.totalQuestions}
        </span>
      </div>

      <h2 className="question-body">{question.body}</h2>

      <div className="choices">
        {question.choices.map((choice) => {
          const isCorrect = choice.id === state.correctChoiceId;
          const isMine = mine?.choiceId === choice.id;
          return (
            <div
              key={choice.id}
              className={[
                "choice-btn",
                "choice-locked",
                isCorrect ? "choice-correct" : "",
                isMine && !isCorrect ? "choice-wrong" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {choice.text}
              {isCorrect && <span className="choice-tag">Correct</span>}
              {isMine && <span className="choice-tag">Your pick</span>}
            </div>
          );
        })}
      </div>

      <p className={`reveal-verdict reveal-${verdict.tone}`}>{verdict.text}</p>

      {mine && mine.points > 0 && (
        <p className="reveal-points">
          +{mine.points} points
          {me?.pointsSoFar ? ` · ${me.pointsSoFar} so far` : ""}
        </p>
      )}

      <div className="show-card live-stat-card">
        <div className="show-label">Still in</div>
        <div className="show-time live-stat-value">
          {state.survivorCount}
          <span className="results-of"> / {state.playerCount}</span>
        </div>
      </div>
    </div>
  );
}
