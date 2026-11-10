import { describe, it, expect } from "vitest";
import {
  answerTiming,
  isWithinAnswerWindow,
  pointsForAnswer,
  scoreShow,
  speedBonusForAnswer,
} from "../scoring";
import { ANSWER_GRACE_MS, QUESTION_DURATION_MS } from "../constants";

describe("answerTiming", () => {
  const start = Date.parse("2026-11-10T20:00:00.000Z");

  it("computes elapsed and remaining from server timestamps", () => {
    expect(answerTiming(start, start + 2_500)).toEqual({
      elapsedMs: 2_500,
      msRemaining: 7_500,
    });
  });

  it("clamps answers in the grace period to 0 remaining", () => {
    expect(answerTiming(start, start + 10_400).msRemaining).toBe(0);
  });

  it("never returns negative elapsed for clock skew", () => {
    expect(answerTiming(start, start - 50)).toEqual({
      elapsedMs: 0,
      msRemaining: QUESTION_DURATION_MS,
    });
  });
});

describe("isWithinAnswerWindow", () => {
  const start = 1_000_000;
  it("accepts during the 10s window and the grace period", () => {
    expect(isWithinAnswerWindow(start, start)).toBe(true);
    expect(isWithinAnswerWindow(start, start + 9_999)).toBe(true);
    expect(isWithinAnswerWindow(start, start + QUESTION_DURATION_MS + ANSWER_GRACE_MS)).toBe(true);
  });
  it("rejects before the question opens and after grace", () => {
    expect(isWithinAnswerWindow(start, start - 1)).toBe(false);
    expect(isWithinAnswerWindow(start, start + QUESTION_DURATION_MS + ANSWER_GRACE_MS + 1)).toBe(false);
    expect(isWithinAnswerWindow(Number.NaN, start)).toBe(false);
  });
});

describe("speed bonus", () => {
  it("is proportional to time left and capped at 50% of base", () => {
    expect(speedBonusForAnswer(100, 2_000)).toBe(20);
    expect(speedBonusForAnswer(100, 5_000)).toBe(50);
    expect(speedBonusForAnswer(100, 9_000)).toBe(50); // capped
    expect(speedBonusForAnswer(100, 0)).toBe(0);
    expect(speedBonusForAnswer(100, -500)).toBe(0);
  });

  it("pointsForAnswer gives 0 for wrong answers", () => {
    expect(pointsForAnswer({ correct: false, difficulty: 3, msRemaining: 9_000 })).toBe(0);
    expect(pointsForAnswer({ correct: true, difficulty: 3, msRemaining: 9_000 })).toBe(450);
    expect(pointsForAnswer({ correct: true, difficulty: 1, msRemaining: 1_000 })).toBe(110);
  });

  it("a faster correct answer scores more than a slower one", () => {
    const run = (msRemaining: number) =>
      scoreShow({
        answers: [{ questionIndex: 0, correct: true, difficulty: 1, msRemaining }],
        eliminatedAtQuestion: null,
        totalQuestions: 12,
        watchedAsSpectator: false,
      }).total;
    expect(run(4_000)).toBeGreaterThan(run(1_000));
    expect(run(1_000)).toBe(100 + 10 + 500);
  });
});
