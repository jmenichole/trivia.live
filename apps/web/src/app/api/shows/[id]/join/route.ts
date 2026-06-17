import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: showId } = await params;
  const supabase = await createClient();
  const user = supabase
    ? (await supabase.auth.getUser()).data.user
    : null;

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: show } = await admin
    .from("shows")
    .select("id, status, current_phase")
    .eq("id", showId)
    .single();

  if (!show || !["scheduled", "lobby", "live"].includes(show.status)) {
    return NextResponse.json({ error: "Show not joinable" }, { status: 400 });
  }

  let guestToken: string | null = null;
  let playerId: string | null = null;

  if (user) {
    playerId = user.id;
    await admin.from("players").upsert({
      id: user.id,
      display_name: user.user_metadata?.full_name ?? "Player",
    });
  } else {
    guestToken = randomUUID();
  }

  const { data: participant, error } = await admin
    .from("show_participants")
    .insert({
      show_id: showId,
      player_id: playerId,
      guest_token: guestToken,
      extra_life_available: false,
    })
    .select("id, guest_token")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    participantId: participant.id,
    guestToken: participant.guest_token,
  });
}
