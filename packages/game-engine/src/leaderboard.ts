export interface LeaderboardEntry {
  participantId: string;
  displayName: string;
  points: number;
  /** Cumulative server-measured answer time across questions faced (ms). */
  totalAnswerMs: number;
  /** 1-based question knocked out on; null = survived the whole show. */
  eliminatedAtQuestion: number | null;
  spectator: boolean;
}

/** Points high → low; ties broken by faster cumulative answer time. */
export function rankLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries
    .filter((e) => !e.spectator)
    .slice()
    .sort(
      (a, b) =>
        b.points - a.points ||
        a.totalAnswerMs - b.totalAnswerMs ||
        a.participantId.localeCompare(b.participantId),
    );
}

/**
 * Prize winners per the official rules: players who answered every question
 * (survivors, not spectators). If more than one survives, the fastest
 * cumulative answer time wins; anyone still tied splits the prize.
 */
export function determineWinners(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const survivors = entries.filter(
    (e) => !e.spectator && e.eliminatedAtQuestion === null,
  );
  if (survivors.length === 0) return [];
  const fastest = Math.min(...survivors.map((e) => e.totalAnswerMs));
  return survivors.filter((e) => e.totalAnswerMs === fastest);
}
