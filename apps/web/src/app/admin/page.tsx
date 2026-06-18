import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateShowForm } from "./CreateShowForm";

type Show = {
  id: string;
  scheduled_at: string;
  status: string;
  theme: string;
};

export default async function AdminPage() {
  let shows: Show[] = [];

  const supabase = await createClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("shows")
      .select("id, scheduled_at, status, theme")
      .order("scheduled_at", { ascending: false });

    if (!error && data) {
      shows = data;
    }
  }

  return (
    <main className="admin-page">
      <h1 className="title">Admin</h1>
      <p className="subtitle">Schedule and manage shows</p>

      <section className="admin-section">
        <h2 className="admin-heading">Schedule new show</h2>
        <CreateShowForm />
      </section>

      <section className="admin-section">
        <h2 className="admin-heading">Shows</h2>
        {shows.length === 0 ? (
          <p className="empty-state">No shows yet.</p>
        ) : (
          <ul className="admin-show-list">
            {shows.map((show) => (
              <li key={show.id} className="admin-show-item">
                <span className="admin-show-time">
                  {new Date(show.scheduled_at).toLocaleString()}
                </span>
                <span className={`admin-status admin-status-${show.status}`}>
                  {show.status}
                </span>
                <span className="admin-show-theme">{show.theme}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/" className="btn admin-back-link">
        Back to home
      </Link>
    </main>
  );
}
