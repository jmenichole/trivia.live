import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateParticipant } from "@/lib/participantAuth";
import { getServerAdProvider } from "@/lib/ads/server";
import { earnCheck, loadShowForEarnCheck } from "@/lib/extraLives";
import type { AdSessionStart } from "@/lib/ads/types";

/** Starts a server-tracked rewarded-ad view for a free extra life. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: showId } = await params;
  const provider = getServerAdProvider();
  if (!provider) {
    return NextResponse.json({ error: "Ads aren't available right now" }, { status: 503 });
  }

  const admin = createAdminClient();
  const auth = await authenticateParticipant(req, admin, showId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const check = earnCheck(await loadShowForEarnCheck(admin, showId), auth.participant);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 409 });
  }

  const { data, error } = await admin
    .from("ad_sessions")
    .insert({ show_id: showId, participant_id: auth.participant.id, provider: provider.id })
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "Could not start ad" }, { status: 500 });
  }

  const body: AdSessionStart = {
    sessionId: data.id,
    provider: provider.id,
    minWatchMs: provider.minWatchMs,
    clientConfig: provider.clientConfig(),
  };
  return NextResponse.json(body);
}
