import { describe, it, expect } from "vitest";
import {
  createInitialState,
  advancePhase,
  submitAnswer,
  participantKey,
} from "../stateMachine";
import type { Question } from "../types";

const questions: Question[] = [
  {
    orderIndex: 1,
    body: "What year did the first iPhone launch?",
    choices: [
      { id: "a", text: "2005" },
      { id: "b", text: "2007" },
      { id: "c", text: "2009" },
    ],
    correctChoiceId: "b",
    difficulty: 1,
    category: "tech",
  },
];

describe("createInitialState", () => {
  it("starts in scheduled with no questions active", () => {
    const state = createInitialState("show-1", questions);
    expect(state.phase).toBe("scheduled");
    expect(state.questionIndex).toBe(-1);
  });
});

describe("advancePhase", () => {
  it("moves scheduled → lobby → question", () => {
    let state = createInitialState("show-1", questions);
    state = advancePhase(state, "lobby");
    expect(state.phase).toBe("lobby");
    state = advancePhase(state, "question");
    expect(state.phase).toBe("question");
    expect(state.questionIndex).toBe(0);
  });
});

describe("submitAnswer", () => {
  it("eliminates on wrong answer without extra life", () => {
    let state = createInitialState("show-1", questions);
    state = advancePhase(state, "lobby");
    state = advancePhase(state, "question");
    const key = participantKey({ playerId: "p1", guestToken: null });
    state = {
      ...state,
      participants: {
        [key]: {
          playerId: "p1",
          guestToken: null,
          eliminatedAtQuestion: null,
          extraLifeAvailable: false,
          extraLifeUsed: false,
        },
      },
      survivorCount: 1,
    };
    const next = submitAnswer(state, {
      participantKey: key,
      questionIndex: 0,
      choiceId: "a",
      submittedAt: new Date().toISOString(),
    });
    expect(next.participants[key].eliminatedAtQuestion).toBe(1);
    expect(next.survivorCount).toBe(0);
  });

  it("consumes extra life on wrong answer when available", () => {
    let state = createInitialState("show-1", questions);
    state = advancePhase(state, "question");
    const key = participantKey({ playerId: "p1", guestToken: null });
    state = {
      ...state,
      participants: {
        [key]: {
          playerId: "p1",
          guestToken: null,
          eliminatedAtQuestion: null,
          extraLifeAvailable: true,
          extraLifeUsed: false,
        },
      },
      survivorCount: 1,
    };
    const next = submitAnswer(state, {
      participantKey: key,
      questionIndex: 0,
      choiceId: "a",
      submittedAt: new Date().toISOString(),
    });
    expect(next.participants[key].eliminatedAtQuestion).toBeNull();
    expect(next.participants[key].extraLifeUsed).toBe(true);
    expect(next.survivorCount).toBe(1);
  });
});
