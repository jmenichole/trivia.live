import {
  createInitialState,
  advancePhase,
  submitAnswer,
  applyTimeouts,
  scoreShow,
  participantKey,
  type ShowRuntimeState,
  type Question,
  type ParticipantState,
  type AnswerSubmission,
} from "@trivia-live/game-engine";
import { supabaseAdmin } from "./supabaseAdmin";

// Phase timing constants (milliseconds)
const LOBBY_WINDOW_MS = 5 * 60 * 1000; // open lobby 5 min before scheduled_at
const QUESTION_DURATION_MS = 10_000;   // players have 10s to answer
const REVEAL_DURATION_MS = 3_000;      // show correct answer for 3s
const RESULTS_DURATION_MS = 30_000;    // leaderboard visible for 30s

interface ShowRow {
  id: string;
  scheduled_at: string;
  status: string;
  current_phase: string;
  current_state: Record<string, unknown>;
  question_set_id: string;
}

interface ParticipantRow {
  id: string;
  player_id: string | null;
  guest_token: string | null;
  eliminated_at_question: number | null;
  extra_life_available: boolean;
  extra_life_used: boolean;
}

function phaseToStatus(phase: string): string {
  switch (phase) {
    case "lobby":    return "lobby";
    case "question":
    case "reveal":
    case "results":  return "live";
    case "completed": return "completed";
    case "cancelled": return "cancelled";
    default:          return "scheduled";
  }
}

// ─── Public entry point ──────────────────────────────────────────────────────

export async function runDueShows(): Promise<void> {
  const { data: shows, error } = await supabaseAdmin
    .from("shows")
    .select("id, scheduled_at, status, current_phase, current_state, question_set_id")
    .not("status", "in", "(completed,cancelled)")
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("[runner] load shows:", error.message);
    return;
  }

  for (const show of shows ?? []) {
    try {
      await processShow(show as ShowRow);
    } catch (err) {
      console.error(`[runner] show ${show.id}:`, err);
    }
  }
}

// ─── Per-show tick ───────────────────────────────────────────────────────────

async function processShow(show: ShowRow): Promise<void> {
  const now = new Date();
  const scheduledAt = new Date(show.scheduled_at);

  // Restore or initialise state
  const raw = show.current_state as Partial<ShowRuntimeState>;
  let state: ShowRuntimeState;
  const isNew = !raw.showId;

  if (isNew) {
    const questions = await loadQuestions(show.question_set_id);
    if (!questions) return;
    state = createInitialState(show.id, questions);
  } else {
    state = raw as ShowRuntimeState;
  }

  const elapsed = now.getTime() - new Date(state.phaseStartedAt).getTime();
  let next: ShowRuntimeState | null = null;

  switch (state.phase) {
    // ── scheduled → lobby (5 min window) ───────────────────────────────────
    case "scheduled": {
      const msUntilShow = scheduledAt.getTime() - now.getTime();
      if (msUntilShow <= LOBBY_WINDOW_MS) {
        state = await refreshParticipants(show.id, state);
        next = advancePhase(state, "lobby");
        console.log(`[runner] ${show.id}: scheduled→lobby`);
      }
      break;
    }

    // ── lobby → question (once scheduled_at is past) ────────────────────
    case "lobby": {
      if (now >= scheduledAt) {
        state = await refreshParticipants(show.id, state);
        next = advancePhase(state, "question");
        console.log(`[runner] ${show.id}: lobby→question[0]`);
      }
      break;
    }

    // ── question → reveal (after 10 s) ──────────────────────────────────
    case "question": {
      if (elapsed >= QUESTION_DURATION_MS) {
        state = await applyQuestionEnd(show.id, state);
        next = advancePhase(state, "reveal");
        console.log(`[runner] ${show.id}: question[${state.questionIndex}]→reveal`);
      }
      break;
    }

    // ── reveal → question | results (after 3 s) ─────────────────────────
    case "reveal": {
      if (elapsed >= REVEAL_DURATION_MS) {
        // advancePhase('question') auto-advances to 'results' when exhausted
        next = advancePhase(state, "question");
        if (next.phase === "results") {
          console.log(`[runner] ${show.id}: reveal→results`);
        } else {
          console.log(`[runner] ${show.id}: reveal→question[${next.questionIndex}]`);
        }
      }
      break;
    }

    // ── results → completed (after 30 s) ────────────────────────────────
    case "results": {
      if (elapsed >= RESULTS_DURATION_MS) {
        await finalizeScores(show.id, state);
        next = advancePhase(state, "completed");
        console.log(`[runner] ${show.id}: results→completed`);
      }
      break;
    }
  }

  if (next) {
    await persistState(show.id, next);
  } else if (isNew) {
    // Persist initial state so we don't re-initialise every tick
    await persistState(show.id, state);
  }
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

async function loadQuestions(questionSetId: string): Promise<Question[] | null> {
  const { data, error } = await supabaseAdmin
    .from("questions")
    .select("order_index, body, choices, correct_choice_id, difficulty, category")
    .eq("question_set_id", questionSetId)
    .order("order_index", { ascending: true });

  if (error || !data) {
    console.error("[runner] load questions:", error?.message);
    return null;
  }

  return data.map((q) => ({
    orderIndex: q.order_index as number,
    body: q.body as string,
    choices: q.choices as { id: string; text: string }[],
    correctChoiceId: q.correct_choice_id as string,
    difficulty: q.difficulty as 1 | 2 | 3,
    category: q.category as string,
  }));
}

async function refreshParticipants(
  showId: string,
  state: ShowRuntimeState
): Promise<ShowRuntimeState> {
  const { data, error } = await supabaseAdmin
    .from("show_participants")
    .select(
      "id, player_id, guest_token, eliminated_at_question, extra_life_available, extra_life_used"
    )
    .eq("show_id", showId);

  if (error || !data) {
    console.error("[runner] load participants:", error?.message);
    return state;
  }

  const participants: Record<string, ParticipantState> = {};
  for (const p of data as ParticipantRow[]) {
    const key = participantKey({ playerId: p.player_id, guestToken: p.guest_token });
    participants[key] = {
      playerId: p.player_id,
      guestToken: p.guest_token,
      eliminatedAtQuestion: p.eliminated_at_question,
      extraLifeAvailable: p.extra_life_available,
      extraLifeUsed: p.extra_life_used,
    };
  }

  const survivorCount = Object.values(participants).filter(
    (p) => p.eliminatedAtQuestion === null
  ).length;

  return { ...state, participants, survivorCount };
}

async function applyQuestionEnd(
  showId: string,
  state: ShowRuntimeState
): Promise<ShowRuntimeState> {
  // Load all participant id → key mappings for this show
  const { data: parts } = await supabaseAdmin
    .from("show_participants")
    .select("id, player_id, guest_token")
    .eq("show_id", showId);

  const keyById: Record<string, string> = {};
  for (const p of (parts ?? []) as ParticipantRow[]) {
    keyById[p.id] = participantKey({ playerId: p.player_id, guestToken: p.guest_token });
  }

  // Load answers submitted during this question
  const { data: answerRows } = await supabaseAdmin
    .from("answers")
    .select("participant_id, choice_id, answered_at")
    .eq("show_id", showId)
    .eq("question_index", state.questionIndex);

  let updatedState = state;
  const answeredKeys = new Set<string>();

  for (const row of answerRows ?? []) {
    const key = keyById[(row as { participant_id: string }).participant_id];
    if (!key) continue;
    answeredKeys.add(key);

    const submission: AnswerSubmission = {
      participantKey: key,
      questionIndex: state.questionIndex,
      choiceId: (row as { choice_id: string | null }).choice_id,
      submittedAt: (row as { answered_at: string }).answered_at,
    };
    updatedState = submitAnswer(updatedState, submission);
  }

  // Mark non-answerers as wrong (timeout = null answer)
  const unansweredKeys = Object.keys(updatedState.participants).filter((k) => {
    const p = updatedState.participants[k];
    return p.eliminatedAtQuestion === null && !answeredKeys.has(k);
  });
  updatedState = applyTimeouts(updatedState, unansweredKeys);

  // Sync elimination state back to show_participants
  await syncEliminations(showId, updatedState, (parts ?? []) as ParticipantRow[]);

  return updatedState;
}

async function syncEliminations(
  showId: string,
  state: ShowRuntimeState,
  parts: ParticipantRow[]
): Promise<void> {
  const rows =
    parts.length > 0
      ? parts
      : ((
          await supabaseAdmin
            .from("show_participants")
            .select("id, player_id, guest_token")
            .eq("show_id", showId)
        ).data as ParticipantRow[] | null) ?? [];

  for (const p of rows) {
    const key = participantKey({ playerId: p.player_id, guestToken: p.guest_token });
    const ps = state.participants[key];
    if (!ps) continue;

    await supabaseAdmin
      .from("show_participants")
      .update({
        eliminated_at_question: ps.eliminatedAtQuestion,
        extra_life_used: ps.extraLifeUsed,
      })
      .eq("id", p.id);
  }
}

async function finalizeScores(showId: string, state: ShowRuntimeState): Promise<void> {
  const { data: parts } = await supabaseAdmin
    .from("show_participants")
    .select(
      "id, player_id, guest_token, eliminated_at_question, extra_life_available, extra_life_used"
    )
    .eq("show_id", showId);

  for (const p of (parts ?? []) as ParticipantRow[]) {
    const { data: answerRows } = await supabaseAdmin
      .from("answers")
      .select("question_index, correct, answered_at")
      .eq("show_id", showId)
      .eq("participant_id", p.id);

    const answers = (answerRows ?? []).map((a) => ({
      questionIndex: (a as { question_index: number }).question_index,
      correct: (a as { correct: boolean }).correct,
      difficulty: (state.questions[(a as { question_index: number }).question_index]?.difficulty ?? 1) as 1 | 2 | 3,
      // Alpha: use midpoint estimate; accurate speed tracking is post-M1
      msRemaining: 5_000,
    }));

    const breakdown = scoreShow({
      answers,
      eliminatedAtQuestion: p.eliminated_at_question,
      totalQuestions: state.questions.length,
      watchedAsSpectator: p.eliminated_at_question !== null,
    });

    const points = Math.round(breakdown.total);

    await supabaseAdmin
      .from("show_participants")
      .update({ points_earned: points })
      .eq("id", p.id);

    if (p.player_id) {
      const { data: player } = await supabaseAdmin
        .from("players")
        .select("total_points")
        .eq("id", p.player_id)
        .single();

      if (player) {
        await supabaseAdmin
          .from("players")
          .update({ total_points: ((player as { total_points: number }).total_points ?? 0) + points })
          .eq("id", p.player_id);
      }
    }
  }
}

async function persistState(showId: string, state: ShowRuntimeState): Promise<void> {
  const { error } = await supabaseAdmin
    .from("shows")
    .update({
      current_phase: state.phase,
      current_state: state as unknown as Record<string, unknown>,
      status: phaseToStatus(state.phase),
    })
    .eq("id", showId);

  if (error) {
    console.error(`[runner] persist show ${showId}:`, error.message);
  }
}
