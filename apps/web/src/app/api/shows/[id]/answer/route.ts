import { NextRequest, NextResponse } from "next/server";
import {
  answerTiming,
  isWithinAnswerWindow,
  participantKey,
  type ShowRuntimeState,
} from "@trivia-live/game-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateParticipant } from "@/lib/participantAuth";

/**
 * Submit an answer for the current question.
 *
 * - The caller must own the participant (guest token or Supabase session).
 * - The question must be live and within its 10s window (+ small grace),
 *   measured on the server clock from when the runner opened it.
 * - First answer wins; answers can't be changed.
 * - Late joiners (spectators) and knocked-out players can't answer.
 * - The response never says whether the answer was correct.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const receivedAt = Date.now();
  const { id: showId } = await params;

  let body: { questionIndex?: unknown; choiceId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { questionIndex, choiceId } = body;
  if (typeof questionIndex !== "number" || typeof choiceId !== "string") {
    return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
  }

  const admin = createAdminClient();

  const auth = await authenticateParticipant(req, admin, showId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const participant = auth.participant;

  const { data: runtimeRow } = await admin
    .from("show_runtime")
    .select("state")
    .eq("show_id", showId)
    .maybeSingle();
  const runtime = (runtimeRow as { state?: ShowRuntimeState } | null)?.state;

  if (!runtime || runtime.phase !== "question") {
    return NextResponse.json({ error: "Not accepting answers" }, { status: 409 });
  }
  if (runtime.questionIndex !== questionIndex) {
    return NextResponse.json({ error: "Wrong question" }, { status: 409 });
  }

  const startedAt = Date.parse(runtime.phaseStartedAt);
  if (!isWithinAnswerWindow(startedAt, receivedAt)) {
    return NextResponse.json({ error: "Time's up" }, { status: 409 });
  }

  const key = participantKey({
    playerId: participant.player_id,
    guestToken: participant.guest_token,
  });
  const ps = runtime.participants[key];
  if (!ps || participant.spectator === true) {
    return NextResponse.json(
      { error: "Spectators can't answer" },
      { status: 403 },
    );
  }
  if (ps.eliminatedAtQuestion !== null || participant.eliminated_at_question !== null) {
    return NextResponse.json({ error: "You're out" }, { status: 403 });
  }

  const question = runtime.questions[questionIndex];
  if (!question || !question.choices.some((c) => c.id === choiceId)) {
    return NextResponse.json({ error: "Invalid choice" }, { status: 400 });
  }

  const { elapsedMs, msRemaining } = answerTiming(startedAt, receivedAt);

  const { error } = await admin.from("answers").insert({
    show_id: showId,
    participant_id: participant.id,
    question_index: questionIndex,
    choice_id: choiceId,
    correct: choiceId === question.correctChoiceId,
    answered_at: new Date(receivedAt).toISOString(),
    answer_ms: elapsedMs,
    ms_remaining: msRemaining,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already answered" }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not record answer" }, { status: 500 });
  }

  return NextResponse.json({ accepted: true, answerMs: elapsedMs });
}
