"use client";

import { useRef, useState } from "react";
import type { MyStatus } from "@/hooks/useMyStatus";
import { clientProviderFor } from "@/lib/ads/client";
import type { AdSessionStart } from "@/lib/ads/types";
import { participantHeaders, type JoinResult } from "@/lib/participantSession";

interface ExtraLifeCardProps {
  showId: string;
  session: JoinResult;
  me: MyStatus | null;
  onChange: () => void;
}

const REASONS: Record<string, string> = {
  already_earned: "You already have your extra life for this show.",
  too_late: "Too late to earn an extra life — it can't be used on the final question.",
  show_over: "This show is over.",
  eliminated: "You're out of this show.",
  spectator: "Spectators can't earn extra lives.",
  ad_not_finished: "The ad didn't finish, so no extra life this time.",
  not_completed: "The ad didn't finish, so no extra life this time.",
  not_granted: "The ad didn't finish, so no extra life this time.",
};

/**
 * Free extra life (one per show): share your link or watch a rewarded ad.
 * No purchases, ever.
 */
export function ExtraLifeCard({ showId, session, me, onChange }: ExtraLifeCardProps) {
  const [adMsLeft, setAdMsLeft] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  if (!me || me.spectator || me.eliminatedAtQuestion != null) return null;

  const shareUrl =
    typeof window !== "undefined" && me.referralCode
      ? `${window.location.origin}/show/${showId}?ref=${me.referralCode}`
      : null;

  async function copyLink() {
    if (!shareUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Play live trivia with me", url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // share sheet dismissed
    }
  }

  async function watchAd() {
    setMessage(null);
    const headers = { "Content-Type": "application/json", ...participantHeaders(session) };
    const startRes = await fetch(`/api/shows/${showId}/extra-life/ad/start`, {
      method: "POST",
      headers,
    });
    if (!startRes.ok) {
      const { error } = (await startRes.json().catch(() => ({}))) as { error?: string };
      setMessage(REASONS[error ?? ""] ?? error ?? "Ads aren't available right now.");
      return;
    }
    const start = (await startRes.json()) as AdSessionStart;
    const provider = clientProviderFor(start.provider);

    abortRef.current = new AbortController();
    setAdMsLeft(start.provider === "mock" ? start.minWatchMs : 0);
    const result = await provider.play({
      start,
      onTick: setAdMsLeft,
      signal: abortRef.current.signal,
    });
    setAdMsLeft(null);

    if (!result.completed) {
      setMessage("The ad didn't finish, so no extra life this time.");
      return;
    }

    const doneRes = await fetch(`/api/shows/${showId}/extra-life/ad/complete`, {
      method: "POST",
      headers,
      body: JSON.stringify({ sessionId: start.sessionId, payload: result.payload }),
    });
    const done = (await doneRes.json().catch(() => ({}))) as {
      granted?: boolean;
      reason?: string;
    };
    setMessage(
      done.granted
        ? "❤️ Extra life earned!"
        : (REASONS[done.reason ?? ""] ?? "Couldn't grant the extra life."),
    );
    onChange();
  }

  if (me.extraLifeUsed) {
    return (
      <div className="show-card extra-life-card">
        <p className="show-label">Extra life</p>
        <p>Used{me.extraLifeUsedAtQuestion ? ` on question ${me.extraLifeUsedAtQuestion}` : ""}.</p>
      </div>
    );
  }

  if (me.extraLifeAvailable) {
    return (
      <div className="show-card extra-life-card">
        <p className="show-label">Extra life</p>
        <p className="extra-life-ready">
          ❤️ Ready
          {me.extraLifeSource === "referral"
            ? " (a friend joined with your link)"
            : me.extraLifeSource === "rewarded_ad"
              ? " (ad watched)"
              : ""}
        </p>
        <p className="subtitle extra-life-help">
          It saves you automatically if you miss a question — except the final one.
        </p>
      </div>
    );
  }

  if (!me.canEarnExtraLife) return message ? <p className="subtitle">{message}</p> : null;

  return (
    <div className="show-card extra-life-card">
      <p className="show-label">Earn a free extra life</p>
      <p className="subtitle extra-life-help">
        One per show. It saves you if you miss a question (not the final one). Free —
        nothing to buy.
      </p>
      <div className="extra-life-actions">
        {me.adsAvailable && (
          <button type="button" className="btn" onClick={watchAd} disabled={adMsLeft !== null}>
            Watch a short ad
          </button>
        )}
        {shareUrl && (
          <button type="button" className="btn btn-ghost" onClick={copyLink}>
            {copied ? "Link copied!" : "Share your invite link"}
          </button>
        )}
      </div>
      <p className="subtitle extra-life-help">
        Invite link: you earn the life when a friend signs in and joins this show with it.
      </p>
      {message && <p className="answered-msg">{message}</p>}

      {adMsLeft !== null && (
        <div className="ad-overlay" role="dialog" aria-label="Rewarded ad">
          <div className="ad-box">
            <p className="show-label">Sponsored · simulated ad (dev)</p>
            <p className="ad-countdown">
              {adMsLeft > 0 ? `${Math.ceil(adMsLeft / 1000)}s` : "…"}
            </p>
            <p className="subtitle">Keep this open to earn your extra life.</p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => abortRef.current?.abort()}
            >
              Close (no reward)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
