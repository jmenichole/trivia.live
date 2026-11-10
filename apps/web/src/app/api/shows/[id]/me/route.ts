import { NextRequest, NextResponse } from "next/server";
import {
  participantKey,
  pointsForAnswer,
  type ShowRuntimeState,
} from "@trivia-live/game-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateParticipant } from "@/lib/participantAuth";
import { earnCheck, loadShowForEarnCheck } from "@/lib/extraLives";
import { getServerAdProvider } from "@/lib/ads/server";

export const dynamic = "force-dynamic";

/** The caller's own status in a show. Never includes other players' data. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: showId } = await params;
  const admin = createAdminClient();
  const auth = await authenticateParticipant(req, admin, showId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const p = auth.participant;

  const { data: runtimeRow } = await admin
    .from("show_runtime")
    .select("state")
    .eq("show_id", showId)
    .maybeSingle();
  const runtime = (runtimeRow as { state?: ShowRuntimeState } | null)?.state;

  // Once questions start, only participants captured in the runtime play.
  const started =
    !!runtime && runtime.phase !== "scheduled" && runtime.phase !== "lobby";
  const key = participantKey({ playerId: p.player_id, guestToken: p.guest_token });
  const spectator =
    p.spectator === true || (started && !runtime!.participants[key]);

  // Only reveal correctness for questions that have reached the reveal.
  let lastAnswer: {
    questionIndex: number;
    choiceId: string | null;
    correct: boolean;
    points: number;
  } | null = null;
  let pointsSoFar = 0;

  if (runtime && runtime.questionIndex >= 0) {
    const { data: answerRows } = await admin
      .from("answers")
      .select("question_index, choice_id, correct, ms_remaining")
      .eq("show_id", showId)
      .eq("participant_id", p.id)
      .order("question_index", { ascending: true });

    const revealedThrough =
      runtime.phase === "question" ? runtime.questionIndex - 1 : runtime.questionIndex;

    for (const a of (answerRows ?? []) as {
      question_index: number;
      choice_id: string | null;
      correct: boolean;
      ms_remaining: number | null;
    }[]) {
      if (a.question_index > revealedThrough) continue;
      const points = pointsForAnswer({
        correct: a.correct,
        difficulty: runtime.questions[a.question_index]?.difficulty ?? 1,
        msRemaining: a.ms_remaining ?? 0,
      });
      pointsSoFar += points;
      if (a.question_index === revealedThrough) {
        lastAnswer = {
          questionIndex: a.question_index,
          choiceId: a.choice_id,
          correct: a.correct,
          points,
        };
      }
    }
  }

  const earn = spectator
    ? { ok: false as const }
    : earnCheck(await loadShowForEarnCheck(admin, showId), p);

  return NextResponse.json({
    participantId: p.id,
    spectator,
    referralCode: spectator ? null : (p.referral_code as string | null) ?? null,
    extraLifeSource: (p.extra_life_source as string | null) ?? null,
    extraLifeUsedAtQuestion: (p.extra_life_used_at_question as number | null) ?? null,
    canEarnExtraLife: earn.ok,
    adsAvailable: getServerAdProvider() !== null,
    lastAnswer,
    /** Per-answer points (base + speed) so far, before end-of-show bonuses. */
    pointsSoFar,
    /** 1-based question number the player was knocked out on, or null. */
    eliminatedAtQuestion: p.eliminated_at_question,
    extraLifeAvailable: p.extra_life_available,
    extraLifeUsed: p.extra_life_used,
    /** Final show total incl. bonuses (set when the show reaches results). */
    pointsEarned: p.points_earned,
  });
}
