import type {
  AnswerSubmission,
  ParticipantState,
  ShowPhase,
  ShowRuntimeState,
  Question,
} from "./types";

export function participantKey(p: {
  playerId: string | null;
  guestToken: string | null;
}): string {
  if (p.playerId) return `player:${p.playerId}`;
  if (p.guestToken) return `guest:${p.guestToken}`;
  throw new Error("participant must have playerId or guestToken");
}

export function createInitialState(
  showId: string,
  questions: Question[],
): ShowRuntimeState {
  return {
    showId,
    phase: "scheduled",
    questionIndex: -1,
    phaseStartedAt: new Date().toISOString(),
    questions,
    participants: {},
    survivorCount: 0,
  };
}

const PHASE_ORDER: ShowPhase[] = [
  "scheduled",
  "lobby",
  "question",
  "reveal",
  "results",
  "completed",
];

export function advancePhase(
  state: ShowRuntimeState,
  target: ShowPhase,
): ShowRuntimeState {
  const next: ShowRuntimeState = {
    ...state,
    phase: target,
    phaseStartedAt: new Date().toISOString(),
  };
  if (target === "question") {
    const nextIndex =
      state.phase === "reveal" ? state.questionIndex + 1 : 0;
    if (nextIndex >= state.questions.length) {
      return { ...next, phase: "results", questionIndex: state.questionIndex };
    }
    return { ...next, questionIndex: nextIndex };
  }
  if (target === "results") {
    return { ...next, phase: "results" };
  }
  if (target === "completed") {
    return { ...next, phase: "completed" };
  }
  return next;
}

export function submitAnswer(
  state: ShowRuntimeState,
  answer: AnswerSubmission,
): ShowRuntimeState {
  const participant = state.participants[answer.participantKey];
  if (!participant) return state;
  if (participant.eliminatedAtQuestion !== null) return state;
  if (answer.questionIndex !== state.questionIndex) return state;

  const question = state.questions[answer.questionIndex];
  const correct = answer.choiceId === question.correctChoiceId;

  if (correct) return state;

  if (participant.extraLifeAvailable && !participant.extraLifeUsed) {
    const updated: ParticipantState = {
      ...participant,
      extraLifeUsed: true,
    };
    return {
      ...state,
      participants: {
        ...state.participants,
        [answer.participantKey]: updated,
      },
    };
  }

  const updated: ParticipantState = {
    ...participant,
    eliminatedAtQuestion: answer.questionIndex + 1,
  };
  return {
    ...state,
    participants: {
      ...state.participants,
      [answer.participantKey]: updated,
    },
    survivorCount: Math.max(0, state.survivorCount - 1),
  };
}

export function applyTimeouts(
  state: ShowRuntimeState,
  unansweredKeys: string[],
): ShowRuntimeState {
  let next = state;
  for (const key of unansweredKeys) {
    next = submitAnswer(next, {
      participantKey: key,
      questionIndex: state.questionIndex,
      choiceId: null,
      submittedAt: new Date().toISOString(),
    });
  }
  return next;
}
