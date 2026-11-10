"use client";

/** What the join API returns and the browser keeps for this show. */
export interface JoinResult {
  participantId: string;
  guestToken: string | null;
  spectator?: boolean;
  referralCode?: string | null;
}

function storageKey(showId: string) {
  return `show-participant:${showId}`;
}

export function loadSession(showId: string): JoinResult | null {
  try {
    const raw = sessionStorage.getItem(storageKey(showId));
    return raw ? (JSON.parse(raw) as JoinResult) : null;
  } catch {
    return null;
  }
}

export function saveSession(showId: string, data: JoinResult) {
  try {
    sessionStorage.setItem(storageKey(showId), JSON.stringify(data));
  } catch {
    // sessionStorage unavailable (private browsing edge case).
  }
}

export function clearSession(showId: string) {
  try {
    sessionStorage.removeItem(storageKey(showId));
  } catch {
    // ignore
  }
}

/** Headers that prove ownership of the participant to the API. */
export function participantHeaders(session: JoinResult): Record<string, string> {
  const h: Record<string, string> = { "x-participant-id": session.participantId };
  if (session.guestToken) h["x-guest-token"] = session.guestToken;
  return h;
}
