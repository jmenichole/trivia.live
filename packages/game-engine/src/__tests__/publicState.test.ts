import { describe, it, expect } from "vitest";
import { createInitialState, advancePhase } from "../stateMachine";
import { toPublicState } from "../publicState";
import type { Question } from "../types";

const questions: Question[] = [0, 1, 2].map((i) => ({
  orderIndex: i + 1,
  body: `Q${i + 1}`,
  choices: [
    { id: "a", text: "A" },
    { id: "b", text: "B" },
  ],
  correctChoiceId: "b",
  difficulty: 1,
  category: "general",
}));

function withPlayer() {
  const s = createInitialState("show-1", questions);
  return {
    ...s,
    participants: {
      "guest:secret-token": {
        playerId: null,
        guestToken: "secret-token",
        eliminatedAtQuestion: null,
        extraLifeAvailable: false,
        extraLifeUsed: false,
      },
    },
    survivorCount: 1,
  };
}

describe("toPublicState", () => {
  it("hides questions before the show starts", () => {
    const pub = toPublicState(advancePhase(withPlayer(), "lobby"));
    expect(pub.currentQuestion).toBeNull();
    expect(pub.correctChoiceId).toBeNull();
    expect(pub.playerCount).toBe(1);
    expect(pub.totalQuestions).toBe(3);
  });

  it("shows only the current question and no answer during the question", () => {
    const s = advancePhase(advancePhase(withPlayer(), "lobby"), "question");
    const pub = toPublicState(s);
    expect(pub.currentQuestion?.body).toBe("Q1");
    expect(pub.correctChoiceId).toBeNull();
    const json = JSON.stringify(pub);
    expect(json).not.toContain("correctChoiceId\":\"b");
    expect(json).not.toContain("Q2");
    expect(json).not.toContain("Q3");
    expect(json).not.toContain("secret-token");
    expect(pub).not.toHaveProperty("questions");
    expect(pub).not.toHaveProperty("participants");
  });

  it("includes the correct answer during reveal", () => {
    let s = advancePhase(advancePhase(withPlayer(), "lobby"), "question");
    s = advancePhase(s, "reveal");
    const pub = toPublicState(s);
    expect(pub.correctChoiceId).toBe("b");
    expect(pub.currentQuestion?.body).toBe("Q1");
  });
});
