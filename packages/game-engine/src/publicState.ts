import { QUESTION_DURATION_MS, REVEAL_DURATION_MS } from "./constants";
import type { PublicQuestion, PublicShowState, ShowRuntimeState } from "./types";

const QUESTION_VISIBLE_PHASES = new Set(["question", "reveal", "results", "completed"]);
const ANSWER_VISIBLE_PHASES = new Set(["reveal", "results", "completed"]);

/**
 * Projects the private runtime state into what every client may see.
 *
 * - Only the current question is included, never future ones.
 * - The correct choice is only included once the question is in reveal
 *   (or the show has moved on to results).
 * - Participant identities (guest tokens, user ids) are never included.
 */
export function toPublicState(state: ShowRuntimeState): PublicShowState {
  const q =
    state.questionIndex >= 0 && QUESTION_VISIBLE_PHASES.has(state.phase)
      ? state.questions[state.questionIndex]
      : undefined;

  const currentQuestion: PublicQuestion | null = q
    ? {
        orderIndex: q.orderIndex,
        body: q.body,
        choices: q.choices.map((c) => ({ id: c.id, text: c.text })),
        difficulty: q.difficulty,
        category: q.category,
      }
    : null;

  return {
    showId: state.showId,
    phase: state.phase,
    questionIndex: state.questionIndex,
    phaseStartedAt: state.phaseStartedAt,
    totalQuestions: state.questions.length,
    questionDurationMs: QUESTION_DURATION_MS,
    revealDurationMs: REVEAL_DURATION_MS,
    currentQuestion,
    correctChoiceId:
      q && ANSWER_VISIBLE_PHASES.has(state.phase) ? q.correctChoiceId : null,
    survivorCount: state.survivorCount,
    playerCount: Object.keys(state.participants).length,
  };
}
