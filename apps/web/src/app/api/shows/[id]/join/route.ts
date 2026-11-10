import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PARTICIPANT_COLUMNS = "id, guest_token, spectator";

/**
 * Join a show.
 *
 * - Before the first question (status scheduled/lobby): joins as a player.
 * - Once the show is live: joins as a spectator (watches, can't answer,
 *   not counted, not prize-eligible).
 * - Signed-in players re-joining get their existing participant back.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: showId } = await params;
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  const admin = createAdminClient();

  const { data: show } = await admin
    .from("shows")
    .select("id, status, current_phase")
    .eq("id", showId)
    .single();

  if (!show || !["scheduled", "lobby", "live"].includes(show.status)) {
    return NextResponse.json({ error: "Show not joinable" }, { status: 400 });
  }

  const spectator = show.status === "live";

  if (user) {
    const { data: existing } = await admin
      .from("show_participants")
      .select(PARTICIPANT_COLUMNS)
      .eq("show_id", showId)
      .eq("player_id", user.id)
      .maybeSingle();
    if (existing) return NextResponse.json(toJoinResult(existing));

    const meta = user.user_metadata ?? {};
    await admin.from("players").upsert({
      id: user.id,
      display_name:
        meta.full_name ?? meta.name ?? meta.user_name ?? user.email?.split("@")[0] ?? "Player",
    });
  }

  const { data: participant, error } = await admin
    .from("show_participants")
    .insert({
      show_id: showId,
      player_id: user?.id ?? null,
      guest_token: user ? null : randomUUID(),
      extra_life_available: false,
      spectator,
    })
    .select(PARTICIPANT_COLUMNS)
    .single();

  if (error || !participant) {
    return NextResponse.json({ error: "Could not join show" }, { status: 400 });
  }

  return NextResponse.json(toJoinResult(participant));
}

function toJoinResult(p: {
  id: string;
  guest_token: string | null;
  spectator: boolean;
}) {
  return {
    participantId: p.id,
    guestToken: p.guest_token,
    spectator: p.spectator,
  };
}
