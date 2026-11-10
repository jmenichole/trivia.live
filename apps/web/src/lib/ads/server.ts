import type { AdProviderId } from "./types";

/** The simulated dev ad runs this long. */
export const MOCK_AD_DURATION_MS = 15_000;
/** Allow for timer jitter between browser and server. */
const CLOCK_TOLERANCE_MS = 500;
/** Sessions older than this can't be redeemed. */
export const AD_SESSION_TTL_MS = 10 * 60 * 1000;

export interface AdSessionRecord {
  id: string;
  provider: string;
  started_at: string;
  completed_at: string | null;
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export interface ServerRewardedAdProvider {
  id: AdProviderId;
  minWatchMs: number;
  clientConfig(): Record<string, string>;
  /** Decide, on the server, whether the reward was really earned. */
  verify(
    session: AdSessionRecord,
    payload: Record<string, unknown>,
    nowMs: number,
  ): VerifyResult;
}

function checkTiming(
  session: AdSessionRecord,
  minWatchMs: number,
  nowMs: number,
): VerifyResult {
  if (session.completed_at) return { ok: false, reason: "already_redeemed" };
  const started = Date.parse(session.started_at);
  if (!Number.isFinite(started)) return { ok: false, reason: "bad_session" };
  const elapsed = nowMs - started;
  if (elapsed > AD_SESSION_TTL_MS) return { ok: false, reason: "expired" };
  if (elapsed + CLOCK_TOLERANCE_MS < minWatchMs) {
    return { ok: false, reason: "ad_not_finished" };
  }
  return { ok: true };
}

/** Dev/test provider: a simulated 15s ad. */
export const mockAdProvider: ServerRewardedAdProvider = {
  id: "mock",
  minWatchMs: MOCK_AD_DURATION_MS,
  clientConfig: () => ({}),
  verify(session, payload, nowMs) {
    if (payload.completed !== true) return { ok: false, reason: "not_completed" };
    return checkTiming(session, MOCK_AD_DURATION_MS, nowMs);
  },
};

/**
 * Google Ad Manager rewarded ads for the web (GPT) — STUB.
 *
 * TODO(ads): GPT web rewarded ads report the reward in the browser
 * (`rewardedSlotGranted`); there is no server-to-server callback we can
 * check here as far as we know (AdMob's server-side verification is for
 * apps). Until a verifiable signal exists, the server can only check that a
 * session it issued was redeemed once, within its TTL, after a minimum
 * watch time. Revisit before relying on this for prizes, and confirm the
 * ad unit is approved for rewarded web inventory.
 */
export function gamAdProvider(adUnitPath: string, minWatchMs: number): ServerRewardedAdProvider {
  return {
    id: "gam",
    minWatchMs,
    clientConfig: () => ({ adUnitPath }),
    verify(session, payload, nowMs) {
      if (payload.granted !== true) return { ok: false, reason: "not_granted" };
      return checkTiming(session, minWatchMs, nowMs);
    },
  };
}

/**
 * AD_PROVIDER = mock | gam | none.
 * Default: mock outside production, none in production (the mock is only
 * used in production when AD_PROVIDER=mock is set explicitly).
 */
export function getServerAdProvider(
  env: Record<string, string | undefined> = process.env,
): ServerRewardedAdProvider | null {
  const configured = env.AD_PROVIDER?.trim().toLowerCase();
  const choice =
    configured || (env.NODE_ENV === "production" ? "none" : "mock");

  if (choice === "mock") return mockAdProvider;
  if (choice === "gam") {
    const unit = env.GAM_REWARDED_AD_UNIT_PATH?.trim();
    if (!unit) return null;
    const min = Number(env.GAM_MIN_WATCH_MS ?? 5_000);
    return gamAdProvider(unit, Number.isFinite(min) ? min : 5_000);
  }
  return null;
}

export function getProviderById(
  id: string,
  env: Record<string, string | undefined> = process.env,
): ServerRewardedAdProvider | null {
  const p = getServerAdProvider(env);
  return p && p.id === id ? p : null;
}
