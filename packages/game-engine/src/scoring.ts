import { ANSWER_GRACE_MS, QUESTION_DURATION_MS } from "./constants";
import type { ScoreBreakdown } from "./types";

export interface ScoredAnswer {
  questionIndex: number;
  correct: boolean;
  difficulty: number;
  msRemaining: number;
}

export interface ScoreShowInput {
  answers: ScoredAnswer[];
  eliminatedAtQuestion: number | null;
  totalQuestions: number;
  watchedAsSpectator: boolean;
}

export const BASE_POINTS_PER_DIFFICULTY = 100;
export const SURVIVAL_BONUS = 500;
export const PERFECT_BONUS = 1000;
export const SPECTATOR_BONUS = 50;

/**
 * Server-side answer timing. `elapsedMs` is how long the player took after
 * the question opened; `msRemaining` is what was left on the 10s clock
 * (clamped to [0, durationMs], so answers in the grace period score 0 speed).
 */
export function answerTiming(
  phaseStartedAtMs: number,
  answeredAtMs: number,
  durationMs: number = QUESTION_DURATION_MS,
): { elapsedMs: number; msRemaining: number } {
  const elapsedMs = Math.max(0, Math.round(answeredAtMs - phaseStartedAtMs));
  const msRemaining = Math.max(0, Math.min(durationMs, durationMs - elapsedMs));
  return { elapsedMs, msRemaining };
}

/** True while the question accepts answers (window + small network grace). */
export function isWithinAnswerWindow(
  phaseStartedAtMs: number,
  nowMs: number,
  durationMs: number = QUESTION_DURATION_MS,
  graceMs: number = ANSWER_GRACE_MS,
): boolean {
  if (!Number.isFinite(phaseStartedAtMs)) return false;
  return nowMs >= phaseStartedAtMs && nowMs <= phaseStartedAtMs + durationMs + graceMs;
}

/** Speed bonus: proportional to time left, capped at 50% of the base. */
export function speedBonusForAnswer(
  base: number,
  msRemaining: number,
  durationMs: number = QUESTION_DURATION_MS,
): number {
  const remaining = Math.max(0, Math.min(durationMs, msRemaining));
  const maxBonus = base * 0.5;
  const proportional = base * (remaining / durationMs);
  return Math.min(maxBonus, proportional);
}

/** Points for a single answer (base + speed), 0 if wrong. */
export function pointsForAnswer(answer: {
  correct: boolean;
  difficulty: number;
  msRemaining: number;
}): number {
  if (!answer.correct) return 0;
  const base = BASE_POINTS_PER_DIFFICULTY * answer.difficulty;
  return Math.round(base + speedBonusForAnswer(base, answer.msRemaining));
}

export function scoreShow(input: ScoreShowInput): ScoreBreakdown {
  let base = 0;
  let speedBonus = 0;

  for (const answer of input.answers) {
    if (!answer.correct) continue;
    const answerBase = BASE_POINTS_PER_DIFFICULTY * answer.difficulty;
    base += answerBase;
    speedBonus += speedBonusForAnswer(answerBase, answer.msRemaining);
  }

  const notEliminated = input.eliminatedAtQuestion === null;
  const survivalBonus = notEliminated ? SURVIVAL_BONUS : 0;

  const allCorrect =
    notEliminated &&
    input.answers.length === input.totalQuestions &&
    input.answers.every((a) => a.correct);
  const perfectBonus = allCorrect ? PERFECT_BONUS : 0;

  const spectatorBonus =
    !notEliminated && input.watchedAsSpectator ? SPECTATOR_BONUS : 0;

  const total =
    base + speedBonus + survivalBonus + perfectBonus + spectatorBonus;

  return {
    base,
    speedBonus,
    survivalBonus,
    perfectBonus,
    spectatorBonus,
    total,
  };
}
