"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { HostMode } from "@/lib/hosts";
import type { ShowRuntimeState } from "@trivia-live/game-engine";

interface UseShowChannelResult {
  state: ShowRuntimeState | null;
  hostMode: HostMode;
  error: string | null;
}

/**
 * Subscribes to real-time updates for a show row.
 *
 * Prerequisites:
 *   - In the Supabase dashboard go to Database → Replication and enable
 *     the `shows` table for realtime so postgres_changes events are emitted.
 */
export function useShowChannel(showId: string): UseShowChannelResult {
  const [state, setState] = useState<ShowRuntimeState | null>(null);
  const [hostMode, setHostMode] = useState<HostMode>("off");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showId) return;

    const supabase = createClient();

    // Initial fetch so we don't wait for the first change event.
    supabase
      .from("shows")
      .select("current_state, host_mode")
      .eq("id", showId)
      .single()
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(fetchError.message);
          return;
        }
        if (data?.current_state) {
          setState(data.current_state as ShowRuntimeState);
        }
        setHostMode((data?.host_mode as HostMode) ?? "off");
      });

    // Realtime subscription – fires whenever the show row is updated.
    const channel = supabase
      .channel(`show-channel:${showId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "shows",
          filter: `id=eq.${showId}`,
        },
        (payload) => {
          const updated = payload.new as {
            current_state?: ShowRuntimeState;
            host_mode?: HostMode;
          };
          if (updated?.current_state) {
            setState(updated.current_state);
          }
          setHostMode(updated.host_mode ?? "off");
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showId]);

  return { state, hostMode, error };
}
