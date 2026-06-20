import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("livekit-server-sdk", () => ({
  AccessToken: vi.fn().mockImplementation(() => ({
    addGrant: vi.fn(),
    toJwt: vi.fn().mockReturnValue("mock-jwt"),
  })),
}));

import { mintLiveKitToken } from "../lib/livekit/mintToken";

describe("mintLiveKitToken", () => {
  beforeEach(() => {
    process.env.LIVEKIT_API_KEY = "key";
    process.env.LIVEKIT_API_SECRET = "secret";
    process.env.LIVEKIT_URL = "wss://test.livekit.cloud";
  });

  it("returns token and url for player subscribe-only", async () => {
    const result = await mintLiveKitToken({
      room: "trivia-abc",
      identity: "player:part-1",
      role: "player",
    });
    expect(result.token).toBe("mock-jwt");
    expect(result.url).toBe("wss://test.livekit.cloud");
  });

  it("throws when LiveKit env missing", async () => {
    delete process.env.LIVEKIT_API_KEY;
    await expect(
      mintLiveKitToken({ room: "r", identity: "i", role: "player" }),
    ).rejects.toThrow("LiveKit not configured");
  });
});
