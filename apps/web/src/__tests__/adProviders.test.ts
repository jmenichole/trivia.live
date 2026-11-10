import { describe, it, expect } from "vitest";
import {
  AD_SESSION_TTL_MS,
  MOCK_AD_DURATION_MS,
  getServerAdProvider,
  mockAdProvider,
  gamAdProvider,
} from "../lib/ads/server";

const started = Date.parse("2026-11-10T20:00:00.000Z");
const session = (over: Partial<{ completed_at: string | null }> = {}) => ({
  id: "s1",
  provider: "mock",
  started_at: new Date(started).toISOString(),
  completed_at: null,
  ...over,
});

describe("mock rewarded ad provider", () => {
  it("is a simulated 15 second ad", () => {
    expect(MOCK_AD_DURATION_MS).toBe(15_000);
    expect(mockAdProvider.minWatchMs).toBe(15_000);
  });

  it("grants only after the full watch time, verified on the server clock", () => {
    expect(mockAdProvider.verify(session(), { completed: true }, started + 5_000)).toEqual({
      ok: false,
      reason: "ad_not_finished",
    });
    expect(mockAdProvider.verify(session(), { completed: true }, started + 15_000).ok).toBe(true);
  });

  it("rejects incomplete, redeemed and expired sessions", () => {
    expect(mockAdProvider.verify(session(), {}, started + 20_000).ok).toBe(false);
    expect(
      mockAdProvider.verify(session({ completed_at: "x" }), { completed: true }, started + 20_000),
    ).toEqual({ ok: false, reason: "already_redeemed" });
    expect(
      mockAdProvider.verify(session(), { completed: true }, started + AD_SESSION_TTL_MS + 1),
    ).toEqual({ ok: false, reason: "expired" });
  });
});

describe("provider selection", () => {
  it("defaults to mock outside production and none in production", () => {
    expect(getServerAdProvider({ NODE_ENV: "development" })?.id).toBe("mock");
    expect(getServerAdProvider({ NODE_ENV: "production" })).toBeNull();
  });

  it("uses mock in production only when asked explicitly", () => {
    expect(getServerAdProvider({ NODE_ENV: "production", AD_PROVIDER: "mock" })?.id).toBe("mock");
  });

  it("GAM needs an ad unit path and a granted payload", () => {
    expect(getServerAdProvider({ AD_PROVIDER: "gam" })).toBeNull();
    const gam = getServerAdProvider({ AD_PROVIDER: "gam", GAM_REWARDED_AD_UNIT_PATH: "/123/rewarded" });
    expect(gam?.id).toBe("gam");
    expect(gam?.clientConfig()).toEqual({ adUnitPath: "/123/rewarded" });
    const g = gamAdProvider("/123/rewarded", 5_000);
    expect(g.verify(session(), { granted: false }, started + 30_000).ok).toBe(false);
    expect(g.verify(session(), { granted: true }, started + 30_000).ok).toBe(true);
  });
});
