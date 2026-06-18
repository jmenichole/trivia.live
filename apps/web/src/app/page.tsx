import Link from "next/link";
import { ShowCountdown } from "@/components/ShowCountdown";
import { createClient } from "@/lib/supabase/server";

type UpcomingShow = {
  id: string;
  scheduled_at: string;
  theme: string;
  status: string;
};

export default async function HomePage() {
  let show: UpcomingShow | null = null;

  const supabase = await createClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("shows")
      .select("id, scheduled_at, theme, status")
      .in("status", ["scheduled", "lobby", "live"])
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!error) {
      show = data;
    }
  }

  return (
    <main>
      <h1 className="title">trivia.live</h1>
      <p className="subtitle">Live trivia. Virtual points. No cash.</p>

      {show ? (
        <div className="show-card">
          <p className="show-label">Next show</p>
          <p className="show-time">
            {new Date(show.scheduled_at).toLocaleString()}
          </p>
          {show.status === "scheduled" && (
            <ShowCountdown scheduledAt={show.scheduled_at} />
          )}
          <Link href={`/show/${show.id}`} className="btn">
            {show.status === "lobby" || show.status === "live"
              ? "Join show"
              : "Join lobby"}
          </Link>
        </div>
      ) : (
        <p className="empty-state">No upcoming shows. Check back soon.</p>
      )}

      <footer className="footer">Part of the TiltCheck ecosystem</footer>
    </main>
  );
}
