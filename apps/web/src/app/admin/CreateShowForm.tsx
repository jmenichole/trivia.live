"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ALPHA_QUESTION_SET_ID = "11111111-1111-1111-1111-111111111111";

export function CreateShowForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const scheduledAt = formData.get("scheduled_at") as string;
    const theme = formData.get("theme") as string;
    const liveAudioHost = formData.get("live_audio_host") === "on";

    const res = await fetch("/api/admin/shows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduled_at: new Date(scheduledAt).toISOString(),
        question_set_id: ALPHA_QUESTION_SET_ID,
        theme: theme || "general",
        host_mode: liveAudioHost ? "live_audio" : "off",
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create show");
      return;
    }

    form.reset();
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label className="admin-label">
        Scheduled at
        <input
          type="datetime-local"
          name="scheduled_at"
          className="admin-input"
          required
        />
      </label>
      <label className="admin-label">
        Theme
        <input
          type="text"
          name="theme"
          className="admin-input"
          defaultValue="general"
          required
        />
      </label>
      <label className="admin-label">
        Question set
        <input
          type="text"
          className="admin-input"
          value="Alpha Pop Culture (M1)"
          readOnly
          disabled
        />
      </label>
      <label className="admin-label admin-checkbox">
        <input type="checkbox" name="live_audio_host" />
        Live audio host (I&apos;ll read questions on mic)
      </label>
      {error && <p className="admin-error">{error}</p>}
      <button type="submit" className="btn" disabled={submitting}>
        {submitting ? "Scheduling…" : "Schedule show"}
      </button>
    </form>
  );
}
