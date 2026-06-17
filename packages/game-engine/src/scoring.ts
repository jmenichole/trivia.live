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

function speedBonusForAnswer(base: number, msRemaining: number): number {
  const maxBonus = base * 0.5;
  const proportional = base * (msRemaining / 10000);
  return Math.min(maxBonus, proportional);
}

export function scoreShow(input: ScoreShowInput): ScoreBreakdown {
  let base = 0;
  let speedBonus = 0;

  for (const answer of input.answers) {
    if (!answer.correct) continue;
    const answerBase = 100 * answer.difficulty;
    base += answerBase;
    speedBonus += speedBonusForAnswer(answerBase, answer.msRemaining);
  }

  const notEliminated = input.eliminatedAtQuestion === null;
  const survivalBonus = notEliminated ? 500 : 0;

  const allCorrect =
    notEliminated &&
    input.answers.length === input.totalQuestions &&
    input.answers.every((a) => a.correct);
  const perfectBonus = allCorrect ? 1000 : 0;

  const spectatorBonus =
    !notEliminated && input.watchedAsSpectator ? 50 : 0;

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
