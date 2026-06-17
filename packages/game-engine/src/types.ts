export type ShowPhase =
  | "scheduled"
  | "lobby"
  | "question"
  | "reveal"
  | "results"
  | "completed"
  | "cancelled";

export interface Choice {
  id: string;
  text: string;
}

export interface Question {
  orderIndex: number;
  body: string;
  choices: Choice[];
  correctChoiceId: string;
  difficulty: 1 | 2 | 3;
  category: string;
}

export interface ParticipantState {
  playerId: string | null;
  guestToken: string | null;
  eliminatedAtQuestion: number | null;
  extraLifeAvailable: boolean;
  extraLifeUsed: boolean;
}

export interface ShowRuntimeState {
  showId: string;
  phase: ShowPhase;
  questionIndex: number; // 0-based; -1 before first question
  phaseStartedAt: string; // ISO
  questions: Question[];
  participants: Record<string, ParticipantState>; // key = participantKey
  survivorCount: number;
}

export interface AnswerSubmission {
  participantKey: string;
  questionIndex: number;
  choiceId: string | null;
  submittedAt: string; // ISO
}

export interface ScoreBreakdown {
  base: number;
  speedBonus: number;
  survivalBonus: number;
  perfectBonus: number;
  spectatorBonus: number;
  total: number;
}
