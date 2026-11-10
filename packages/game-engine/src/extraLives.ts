import type { ParticipantState, ShowPhase } from "./types";

/**
 * Free extra lives (no purchases): earned by a referral or a rewarded ad.
 * At most one per player per show.
 */
export const MAX_EXTRA_LIVES_PER_SHOW = 1;

export type ExtraLifeSource = "referral" | "rewarded_ad";

/**
 * A life is consumed automatically when the player misses (wrong answer or
 * no answer) and is applied before the next question opens. It can never
 * save a miss on the final question.
 */
export function canUseExtraLife(
  participant: Pick<
    ParticipantState,
    "eliminatedAtQuestion" | "extraLifeAvailable" | "extraLifeUsed"
  >,
  questionIndex: number,
  totalQuestions: number,
): boolean {
  if (participant.eliminatedAtQuestion !== null) return false;
  if (!participant.extraLifeAvailable || participant.extraLifeUsed) return false;
  const isFinalQuestion = questionIndex >= totalQuestions - 1;
  return !isFinalQuestion;
}

export type EarnBlockReason =
  | "spectator"
  | "eliminated"
  | "already_earned"
  | "too_late"
  | "show_over";

export interface EarnCheckShow {
  phase: ShowPhase;
  questionIndex: number; // -1 before Q1
  totalQuestions: number; // 0 if unknown (runner hasn't initialised yet)
}

export interface EarnCheckParticipant {
  spectator: boolean;
  eliminatedAtQuestion: number | null;
  extraLifeAvailable: boolean;
  extraLifeUsed: boolean;
}

/**
 * Whether a player may earn their (one) extra life right now. It must be
 * possible to still use it: the next question it could save can't be the
 * final question.
 */
export function canEarnExtraLife(
  show: EarnCheckShow,
  participant: EarnCheckParticipant,
): { ok: true } | { ok: false; reason: EarnBlockReason } {
  if (participant.spectator) return { ok: false, reason: "spectator" };
  if (participant.eliminatedAtQuestion !== null) {
    return { ok: false, reason: "eliminated" };
  }
  if (participant.extraLifeAvailable || participant.extraLifeUsed) {
    return { ok: false, reason: "already_earned" };
  }

  switch (show.phase) {
    case "scheduled":
    case "lobby":
      return { ok: true };
    case "question":
    case "reveal": {
      if (show.totalQuestions <= 0) return { ok: false, reason: "too_late" };
      // During a question the life can still save that question;
      // during its reveal, the earliest it can save is the next one.
      const nextUsable =
        show.phase === "question" ? show.questionIndex : show.questionIndex + 1;
      return nextUsable < show.totalQuestions - 1
        ? { ok: true }
        : { ok: false, reason: "too_late" };
    }
    default:
      return { ok: false, reason: "show_over" };
  }
}
