import { describe, it, expect } from "vitest";
import { advancePhase, createInitialState, participantKey, submitAnswer } from "../stateMachine";
import { canEarnExtraLife, canUseExtraLife, MAX_EXTRA_LIVES_PER_SHOW } from "../extraLives";
import type { ParticipantState, Question, ShowRuntimeState } from "../types";

const questions: Question[] = Array.from({ length: 3 }, (_, i) => ({
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

const key = participantKey({ playerId: "p1", guestToken: null });

function stateAt(questionIndex: number, p: Partial<ParticipantState> = {}): ShowRuntimeState {
  let s = advancePhase(createInitialState("show-1", questions), "question");
  s = { ...s, questionIndex };
  return {
    ...s,
    participants: {
      [key]: {
        playerId: "p1",
        guestToken: null,
        eliminatedAtQuestion: null,
        extraLifeAvailable: true,
        extraLifeUsed: false,
        ...p,
      },
    },
    survivorCount: 1,
  };
}

const wrong = (questionIndex: number) => ({
  participantKey: key,
  questionIndex,
  choiceId: "a",
  submittedAt: new Date().toISOString(),
});

describe("extra life usage", () => {
  it("caps lives at one per show", () => {
    expect(MAX_EXTRA_LIVES_PER_SHOW).toBe(1);
  });

  it("saves a wrong answer before the final question and records where", () => {
    const next = submitAnswer(stateAt(0), wrong(0));
    const p = next.participants[key];
    expect(p.eliminatedAtQuestion).toBeNull();
    expect(p.extraLifeUsed).toBe(true);
    expect(p.extraLifeUsedAtQuestion).toBe(1);
  });

  it("saves a timeout (no answer) the same way", () => {
    const next = submitAnswer(stateAt(1), { ...wrong(1), choiceId: null });
    expect(next.participants[key].eliminatedAtQuestion).toBeNull();
    expect(next.participants[key].extraLifeUsedAtQuestion).toBe(2);
  });

  it("never applies on the final question", () => {
    const next = submitAnswer(stateAt(2), wrong(2));
    expect(next.participants[key].eliminatedAtQuestion).toBe(3);
    expect(next.participants[key].extraLifeUsed).toBe(false);
    expect(next.survivorCount).toBe(0);
  });

  it("can only be used once per show", () => {
    let s = submitAnswer(stateAt(0), wrong(0));
    s = { ...s, questionIndex: 1 };
    s = submitAnswer(s, wrong(1));
    expect(s.participants[key].eliminatedAtQuestion).toBe(2);
  });

  it("is not consumed by a correct answer", () => {
    const next = submitAnswer(stateAt(0), { ...wrong(0), choiceId: "b" });
    expect(next.participants[key].extraLifeUsed).toBe(false);
  });

  it("canUseExtraLife rejects knocked-out players and players without a life", () => {
    const base = { eliminatedAtQuestion: null, extraLifeAvailable: true, extraLifeUsed: false };
    expect(canUseExtraLife(base, 0, 3)).toBe(true);
    expect(canUseExtraLife({ ...base, eliminatedAtQuestion: 1 }, 1, 3)).toBe(false);
    expect(canUseExtraLife({ ...base, extraLifeAvailable: false }, 0, 3)).toBe(false);
    expect(canUseExtraLife({ ...base, extraLifeUsed: true }, 0, 3)).toBe(false);
    expect(canUseExtraLife(base, 2, 3)).toBe(false);
  });
});

describe("canEarnExtraLife", () => {
  const fresh = {
    spectator: false,
    eliminatedAtQuestion: null,
    extraLifeAvailable: false,
    extraLifeUsed: false,
  };
  const show = (phase: ShowRuntimeState["phase"], questionIndex = -1) => ({
    phase,
    questionIndex,
    totalQuestions: 12,
  });

  it("allows earning before the show and early in it", () => {
    expect(canEarnExtraLife(show("scheduled"), fresh).ok).toBe(true);
    expect(canEarnExtraLife(show("lobby"), fresh).ok).toBe(true);
    expect(canEarnExtraLife(show("question", 0), fresh).ok).toBe(true);
    expect(canEarnExtraLife(show("reveal", 9), fresh).ok).toBe(true);
  });

  it("refuses once it could only apply to the final question", () => {
    expect(canEarnExtraLife(show("question", 11), fresh)).toEqual({ ok: false, reason: "too_late" });
    expect(canEarnExtraLife(show("reveal", 10), fresh)).toEqual({ ok: false, reason: "too_late" });
    expect(canEarnExtraLife(show("results", 11), fresh)).toEqual({ ok: false, reason: "show_over" });
  });

  it("caps at one per show (available or already used)", () => {
    expect(canEarnExtraLife(show("lobby"), { ...fresh, extraLifeAvailable: true })).toEqual({
      ok: false,
      reason: "already_earned",
    });
    expect(canEarnExtraLife(show("question", 3), { ...fresh, extraLifeUsed: true })).toEqual({
      ok: false,
      reason: "already_earned",
    });
  });

  it("refuses spectators and knocked-out players", () => {
    expect(canEarnExtraLife(show("lobby"), { ...fresh, spectator: true }).ok).toBe(false);
    expect(canEarnExtraLife(show("reveal", 2), { ...fresh, eliminatedAtQuestion: 3 }).ok).toBe(false);
  });
});
