import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const PARTICIPANT_HEADER = "x-participant-id";
export const GUEST_TOKEN_HEADER = "x-guest-token";

export interface ParticipantRow {
  id: string;
  show_id: string;
  player_id: string | null;
  guest_token: string | null;
  eliminated_at_question: number | null;
  extra_life_available: boolean;
  extra_life_used: boolean;
  points_earned: number;
  [column: string]: unknown;
}

export type ParticipantAuthResult =
  | { ok: true; participant: ParticipantRow }
  | { ok: false; status: number; error: string };

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Proves the caller owns the participant row they name:
 * - guest participants must present their guest token (x-guest-token);
 * - signed-in participants must hold the Supabase session for player_id.
 */
export async function authenticateParticipant(
  req: NextRequest,
  admin: SupabaseClient,
  showId: string,
): Promise<ParticipantAuthResult> {
  const participantId = req.headers.get(PARTICIPANT_HEADER);
  const guestToken = req.headers.get(GUEST_TOKEN_HEADER);

  if (!participantId) {
    return { ok: false, status: 401, error: "Missing participant" };
  }

  const { data, error } = await admin
    .from("show_participants")
    .select("*")
    .eq("id", participantId)
    .eq("show_id", showId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, status: 403, error: "Invalid participant" };
  }
  const participant = data as ParticipantRow;

  if (participant.player_id) {
    const supabase = await createClient();
    const user = supabase ? (await supabase.auth.getUser()).data.user : null;
    if (!user || user.id !== participant.player_id) {
      return { ok: false, status: 403, error: "Not your participant" };
    }
    return { ok: true, participant };
  }

  if (
    !participant.guest_token ||
    !guestToken ||
    !safeEqual(participant.guest_token, guestToken)
  ) {
    return { ok: false, status: 403, error: "Not your participant" };
  }
  return { ok: true, participant };
}
