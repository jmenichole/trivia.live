import { describe, it, expect } from "vitest";
import { scoreShow } from "../scoring";

describe("scoreShow", () => {
  it("awards base + speed bonus for correct answers", () => {
    const result = scoreShow({
      answers: [
        { questionIndex: 0, correct: true, difficulty: 2, msRemaining: 5000 },
      ],
      eliminatedAtQuestion: null,
      totalQuestions: 12,
      watchedAsSpectator: false,
    });
    expect(result.base).toBe(200);
    expect(result.speedBonus).toBe(100);
    expect(result.survivalBonus).toBe(500);
    expect(result.perfectBonus).toBe(0);
    expect(result.total).toBe(800);
  });

  it("awards perfect bonus when all correct and not eliminated", () => {
    const answers = Array.from({ length: 12 }, (_, i) => ({
      questionIndex: i,
      correct: true,
      difficulty: 1,
      msRemaining: 8000,
    }));
    const result = scoreShow({
      answers,
      eliminatedAtQuestion: null,
      totalQuestions: 12,
      watchedAsSpectator: false,
    });
    expect(result.perfectBonus).toBe(1000);
  });

  it("awards spectator bonus when eliminated early", () => {
    const result = scoreShow({
      answers: [{ questionIndex: 0, correct: false, difficulty: 1, msRemaining: 0 }],
      eliminatedAtQuestion: 1,
      totalQuestions: 12,
      watchedAsSpectator: true,
    });
    expect(result.spectatorBonus).toBe(50);
    expect(result.survivalBonus).toBe(0);
  });
});
