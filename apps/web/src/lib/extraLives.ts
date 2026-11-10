import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canEarnExtraLife,
  type EarnBlockReason,
  type ExtraLifeSource,
  type PublicShowState,
} from "@trivia-live/game-engine";
import type { ParticipantRow } from "@/lib/participantAuth";

export type GrantResult =
  | { granted: true }
  | { granted: false; reason: EarnBlockReason | "error" };

/** Reads the public show state used for the earn-window check. */
export async function loadShowForEarnCheck(admin: SupabaseClient, showId: string) {
  const { data } = await admin
    .from("shows")
    .select("current_phase, current_state")
    .eq("id", showId)
    .maybeSingle();
  if (!data) return null;
  const pub = data.current_state as Partial<PublicShowState>;
  return {
    phase: (pub.phase ?? data.current_phase) as PublicShowState["phase"],
    questionIndex: pub.questionIndex ?? -1,
    totalQuestions: pub.totalQuestions ?? 0,
  };
}

export function earnCheck(
  show: Awaited<ReturnType<typeof loadShowForEarnCheck>>,
  p: ParticipantRow,
) {
  if (!show) return { ok: false as const, reason: "show_over" as const };
  return canEarnExtraLife(show, {
    spectator: p.spectator === true,
    eliminatedAtQuestion: p.eliminated_at_question,
    extraLifeAvailable: p.extra_life_available,
    extraLifeUsed: p.extra_life_used,
  });
}

/**
 * Grants a participant their one free extra life for this show.
 * The unique (show_id, participant_id) on extra_life_grants is the hard cap.
 */
export async function grantExtraLife(
  admin: SupabaseClient,
  opts: {
    showId: string;
    participant: ParticipantRow;
    source: ExtraLifeSource;
    adSessionId?: string;
    referredParticipantId?: string;
  },
): Promise<GrantResult> {
  const show = await loadShowForEarnCheck(admin, opts.showId);
  const check = earnCheck(show, opts.participant);
  if (!check.ok) return { granted: false, reason: check.reason };

  const { error: grantError } = await admin.from("extra_life_grants").insert({
    show_id: opts.showId,
    participant_id: opts.participant.id,
    source: opts.source,
    ad_session_id: opts.adSessionId ?? null,
    referred_participant_id: opts.referredParticipantId ?? null,
  });
  if (grantError) {
    return {
      granted: false,
      reason: grantError.code === "23505" ? "already_earned" : "error",
    };
  }

  const { error } = await admin
    .from("show_participants")
    .update({ extra_life_available: true, extra_life_source: opts.source })
    .eq("id", opts.participant.id)
    .eq("extra_life_used", false);
  return error ? { granted: false, reason: "error" } : { granted: true };
}
