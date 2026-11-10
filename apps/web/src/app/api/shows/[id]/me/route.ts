import { NextRequest, NextResponse } from "next/server";
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

  return NextResponse.json({
    participantId: p.id,
    /** 1-based question number the player was knocked out on, or null. */
    eliminatedAtQuestion: p.eliminated_at_question,
    extraLifeAvailable: p.extra_life_available,
    extraLifeUsed: p.extra_life_used,
    pointsEarned: p.points_earned,
  });
}
