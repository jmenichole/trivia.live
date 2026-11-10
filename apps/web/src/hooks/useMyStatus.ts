"use client";

import { useCallback, useEffect, useState } from "react";
import { participantHeaders, type JoinResult } from "@/lib/participantSession";

export interface MyStatus {
  participantId: string;
  spectator?: boolean;
  eliminatedAtQuestion: number | null;
  extraLifeAvailable: boolean;
  extraLifeUsed: boolean;
  extraLifeUsedAtQuestion?: number | null;
  extraLifeSource?: "referral" | "rewarded_ad" | null;
  canEarnExtraLife?: boolean;
  referralCode?: string | null;
  pointsEarned: number;
  pointsSoFar?: number;
  lastAnswer?: {
    questionIndex: number;
    choiceId: string | null;
    correct: boolean;
    points: number;
  } | null;
}

/**
 * Fetches the caller's own status. Re-fetches whenever `refreshKey`
 * changes (e.g. on each phase/question change).
 */
export function useMyStatus(
  showId: string,
  session: JoinResult | null,
  refreshKey: string,
) {
  const [me, setMe] = useState<MyStatus | null>(null);

  const reload = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(`/api/shows/${showId}/me`, {
        headers: participantHeaders(session),
        cache: "no-store",
      });
      if (res.ok) setMe((await res.json()) as MyStatus);
    } catch {
      // keep the last known status
    }
  }, [showId, session]);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  return { me, reload };
}
