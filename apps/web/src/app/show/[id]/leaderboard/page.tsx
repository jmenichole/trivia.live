import Link from "next/link";
import {
  determineWinners,
  rankLeaderboard,
  type LeaderboardEntry,
} from "@trivia-live/game-engine";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  eliminated_at_question: number | null;
  points_earned: number;
  total_answer_ms: number;
  spectator: boolean;
  players: { display_name: string } | { display_name: string }[] | null;
};

function nameFor(row: Row): string {
  const player = Array.isArray(row.players) ? row.players[0] : row.players;
  return player?.display_name ?? `Guest ${row.id.slice(0, 4).toUpperCase()}`;
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: showId } = await params;

  if (!isAdminClientConfigured()) {
    return (
      <main>
        <h1 className="title">Leaderboard</h1>
        <p className="subtitle">Not configured.</p>
      </main>
    );
  }

  const admin = createAdminClient();
  const { data: show } = await admin
    .from("shows")
    .select("id, scheduled_at, theme, current_phase")
    .eq("id", showId)
    .maybeSingle();

  if (!show) {
    return (
      <main>
        <h1 className="title">Leaderboard</h1>
        <p className="subtitle">Show not found.</p>
      </main>
    );
  }

  const finished = show.current_phase === "results" || show.current_phase === "completed";

  let ranked: LeaderboardEntry[] = [];
  let winnerIds = new Set<string>();
  if (finished) {
    const { data } = await admin
      .from("show_participants")
      .select(
        "id, eliminated_at_question, points_earned, total_answer_ms, spectator, players(display_name)",
      )
      .eq("show_id", showId)
      .limit(5000);

    const entries: LeaderboardEntry[] = ((data ?? []) as unknown as Row[]).map((r) => ({
      participantId: r.id,
      displayName: nameFor(r),
      points: r.points_earned,
      totalAnswerMs: r.total_answer_ms,
      eliminatedAtQuestion: r.eliminated_at_question,
      spectator: r.spectator,
    }));
    ranked = rankLeaderboard(entries).slice(0, 100);
    winnerIds = new Set(determineWinners(entries).map((w) => w.participantId));
  }

  return (
    <main>
      <p className="show-label">
        {new Date(show.scheduled_at).toLocaleString()} · {show.theme}
      </p>
      <h1 className="title">Leaderboard</h1>

      {!finished ? (
        <p className="subtitle">
          The leaderboard appears when the show ends.{" "}
          <Link href={`/show/${showId}`}>Back to the show</Link>
        </p>
      ) : ranked.length === 0 ? (
        <p className="subtitle">Nobody played this one.</p>
      ) : (
        <>
          <p className="subtitle">
            {winnerIds.size === 0
              ? "No one survived all the questions."
              : winnerIds.size === 1
                ? "🏆 Winner: answered every question, fastest total time."
                : `🏆 ${winnerIds.size} winners tied on time and split the prize.`}
          </p>
          <table className="leaderboard">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th className="num">Points</th>
                <th className="num">Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, i) => (
                <tr
                  key={r.participantId}
                  className={winnerIds.has(r.participantId) ? "leaderboard-winner" : ""}
                >
                  <td>{i + 1}</td>
                  <td>
                    {winnerIds.has(r.participantId) ? "🏆 " : ""}
                    {r.displayName}
                  </td>
                  <td className="num">{r.points}</td>
                  <td className="num">{formatSeconds(r.totalAnswerMs)}</td>
                  <td>
                    {r.eliminatedAtQuestion === null
                      ? "Survived"
                      : `Out Q${r.eliminatedAtQuestion}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <Link href="/" className="btn">
        Home
      </Link>
    </main>
  );
}
