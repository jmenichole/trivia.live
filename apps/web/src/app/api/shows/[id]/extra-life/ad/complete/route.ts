import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateParticipant } from "@/lib/participantAuth";
import { getProviderById, type AdSessionRecord } from "@/lib/ads/server";
import { grantExtraLife } from "@/lib/extraLives";

/**
 * Redeems a finished rewarded-ad session for the free extra life.
 * The server checks the session it issued (owner, provider, watch time,
 * single use) before granting; the client's word alone is never enough.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const now = Date.now();
  const { id: showId } = await params;

  let body: { sessionId?: unknown; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.sessionId !== "string") {
    return NextResponse.json({ error: "Missing session" }, { status: 400 });
  }
  const payload =
    body.payload && typeof body.payload === "object"
      ? (body.payload as Record<string, unknown>)
      : {};

  const admin = createAdminClient();
  const auth = await authenticateParticipant(req, admin, showId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: session } = await admin
    .from("ad_sessions")
    .select("id, provider, started_at, completed_at")
    .eq("id", body.sessionId)
    .eq("show_id", showId)
    .eq("participant_id", auth.participant.id)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "Unknown ad session" }, { status: 404 });
  }

  const provider = getProviderById((session as AdSessionRecord).provider);
  if (!provider) {
    return NextResponse.json({ error: "Ad provider unavailable" }, { status: 503 });
  }

  const verdict = provider.verify(session as AdSessionRecord, payload, now);
  if (!verdict.ok) {
    return NextResponse.json({ granted: false, reason: verdict.reason }, { status: 409 });
  }

  // Single use: only the first redeem flips completed_at.
  const { data: claimed } = await admin
    .from("ad_sessions")
    .update({ completed_at: new Date(now).toISOString(), rewarded: true })
    .eq("id", session.id)
    .is("completed_at", null)
    .select("id");
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ granted: false, reason: "already_redeemed" }, { status: 409 });
  }

  const result = await grantExtraLife(admin, {
    showId,
    participant: auth.participant,
    source: "rewarded_ad",
    adSessionId: session.id,
  });
  return NextResponse.json(result, { status: result.granted ? 200 : 409 });
}
