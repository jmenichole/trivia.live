import { NextRequest, NextResponse } from "next/server";
import { participantKey, type ShowRuntimeState } from "@trivia-live/game-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateParticipant } from "@/lib/participantAuth";

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

  return NextResponse.json({
    participantId: p.id,
    spectator,
    /** 1-based question number the player was knocked out on, or null. */
    eliminatedAtQuestion: p.eliminated_at_question,
    extraLifeAvailable: p.extra_life_available,
    extraLifeUsed: p.extra_life_used,
    pointsEarned: p.points_earned,
  });
}
