/** Rewarded-ad providers. Ads are the only way (with referrals) to earn an
 * extra life; nothing is ever sold. */
export type AdProviderId = "mock" | "gam";

/** What the start route hands the browser. */
export interface AdSessionStart {
  sessionId: string;
  provider: AdProviderId;
  /** The browser must play at least this long; the server re-checks. */
  minWatchMs: number;
  /** Provider-specific client config (e.g. GAM ad unit path). */
  clientConfig: Record<string, string>;
}
