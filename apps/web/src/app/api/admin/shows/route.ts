import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { roomNameForShow } from "@/lib/hosts";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admins = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!user || !admins.includes(user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { scheduled_at, question_set_id, theme, host_mode: rawHostMode } = body;

  if (!scheduled_at || !question_set_id || !theme) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const host_mode = rawHostMode === "live_audio" ? "live_audio" : "off";

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await admin
    .from("shows")
    .insert({ scheduled_at, question_set_id, theme, host_mode })
    .select("id, scheduled_at, status, theme, host_mode, livekit_room")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (host_mode === "live_audio") {
    const livekit_room = roomNameForShow(data.id);
    const { data: updated, error: updateError } = await admin
      .from("shows")
      .update({ livekit_room })
      .eq("id", data.id)
      .select("id, scheduled_at, status, theme, host_mode, livekit_room")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json(updated);
  }

  return NextResponse.json(data);
}
