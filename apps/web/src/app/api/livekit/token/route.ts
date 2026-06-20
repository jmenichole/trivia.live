import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { isHostUser, roomNameForShow } from "@/lib/hosts";
import { mintLiveKitToken } from "@/lib/livekit/mintToken";

export async function GET(req: NextRequest) {
  const showId = req.nextUrl.searchParams.get("showId");
  const role = req.nextUrl.searchParams.get("role");
  const participantId = req.nextUrl.searchParams.get("participantId");

  if (!showId || (role !== "host" && role !== "player")) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: show } = await admin
    .from("shows")
    .select("id, host_mode, livekit_room")
    .eq("id", showId)
    .single();

  if (!show) {
    return NextResponse.json({ error: "Show not found" }, { status: 404 });
  }

  if (show.host_mode !== "live_audio") {
    return NextResponse.json({ error: "Show not hosted" }, { status: 400 });
  }

  const room = show.livekit_room ?? roomNameForShow(showId);

  if (role === "host") {
    const supabase = await createClient();
    const { data: { user } } = await supabase!.auth.getUser();
    if (!isHostUser(user?.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
      const { token, url } = await mintLiveKitToken({
        room,
        identity: `host:${user!.id}`,
        role: "host",
      });
      return NextResponse.json({ token, url });
    } catch {
      return NextResponse.json({ error: "LiveKit unavailable" }, { status: 503 });
    }
  }

  // player
  if (!participantId) {
    return NextResponse.json({ error: "participantId required" }, { status: 400 });
  }
  const { data: participant } = await admin
    .from("show_participants")
    .select("id")
    .eq("id", participantId)
    .eq("show_id", showId)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json({ error: "Invalid participant" }, { status: 403 });
  }

  try {
    const { token, url } = await mintLiveKitToken({
      room,
      identity: `player:${participantId}`,
      role: "player",
    });
    return NextResponse.json({ token, url });
  } catch {
    return NextResponse.json({ error: "LiveKit unavailable" }, { status: 503 });
  }
}
