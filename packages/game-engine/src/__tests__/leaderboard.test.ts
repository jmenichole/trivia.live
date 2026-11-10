import { describe, it, expect } from "vitest";
import { determineWinners, rankLeaderboard, type LeaderboardEntry } from "../leaderboard";

const e = (id: string, over: Partial<LeaderboardEntry> = {}): LeaderboardEntry => ({
  participantId: id,
  displayName: id,
  points: 0,
  totalAnswerMs: 60_000,
  eliminatedAtQuestion: null,
  spectator: false,
  ...over,
});

describe("rankLeaderboard", () => {
  it("orders by points, then faster cumulative time, and drops spectators", () => {
    const ranked = rankLeaderboard([
      e("slow", { points: 1000, totalAnswerMs: 50_000 }),
      e("fast", { points: 1000, totalAnswerMs: 30_000 }),
      e("top", { points: 2000 }),
      e("watcher", { points: 9999, spectator: true }),
    ]);
    expect(ranked.map((r) => r.participantId)).toEqual(["top", "fast", "slow"]);
  });
});

describe("determineWinners", () => {
  it("returns no winner when nobody survives", () => {
    expect(determineWinners([e("a", { eliminatedAtQuestion: 3 })])).toEqual([]);
  });

  it("fastest cumulative answer time wins among survivors", () => {
    const winners = determineWinners([
      e("a", { totalAnswerMs: 40_000 }),
      e("b", { totalAnswerMs: 35_000 }),
      e("out", { totalAnswerMs: 1_000, eliminatedAtQuestion: 2 }),
    ]);
    expect(winners.map((w) => w.participantId)).toEqual(["b"]);
  });

  it("exact ties split (all tied are returned)", () => {
    const winners = determineWinners([
      e("a", { totalAnswerMs: 35_000 }),
      e("b", { totalAnswerMs: 35_000 }),
      e("c", { totalAnswerMs: 36_000 }),
    ]);
    expect(winners.map((w) => w.participantId).sort()).toEqual(["a", "b"]);
  });

  it("spectators can't win", () => {
    expect(determineWinners([e("late", { spectator: true, totalAnswerMs: 0 })])).toEqual([]);
  });
});
