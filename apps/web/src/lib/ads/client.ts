"use client";

import type { AdProviderId, AdSessionStart } from "./types";

export interface RewardedAdResult {
  completed: boolean;
  /** Sent to the server's verify(). */
  payload: Record<string, unknown>;
}

export interface PlayOptions {
  start: AdSessionStart;
  /** Called with ms left on the simulated timer (mock only). */
  onTick?: (msLeft: number) => void;
  signal?: AbortSignal;
}

export interface ClientRewardedAdProvider {
  id: AdProviderId;
  play(opts: PlayOptions): Promise<RewardedAdResult>;
}

/** Simulated ad: a countdown the UI renders as a fake ad. */
export const mockClientProvider: ClientRewardedAdProvider = {
  id: "mock",
  play({ start, onTick, signal }) {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const id = window.setInterval(() => {
        const left = Math.max(0, start.minWatchMs - (Date.now() - startedAt));
        onTick?.(left);
        if (left === 0) {
          window.clearInterval(id);
          resolve({ completed: true, payload: { completed: true } });
        }
      }, 200);
      signal?.addEventListener("abort", () => {
        window.clearInterval(id);
        resolve({ completed: false, payload: { completed: false } });
      });
    });
  },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type GoogleTag = any;
declare global {
  interface Window {
    googletag?: GoogleTag;
  }
}

function loadGpt(): Promise<GoogleTag> {
  return new Promise((resolve, reject) => {
    if (window.googletag?.apiReady) return resolve(window.googletag);
    window.googletag = window.googletag || { cmd: [] };
    const script = document.createElement("script");
    script.src = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
    script.async = true;
    script.onload = () => resolve(window.googletag);
    script.onerror = () => reject(new Error("GPT failed to load"));
    document.head.appendChild(script);
  });
}

/**
 * Google Ad Manager rewarded web ad — STUB, untested against a live ad unit.
 * Uses GPT's out-of-page REWARDED format and its rewardedSlotReady /
 * rewardedSlotGranted / rewardedSlotClosed events.
 */
export const gamClientProvider: ClientRewardedAdProvider = {
  id: "gam",
  async play({ start, signal }) {
    const adUnitPath = start.clientConfig.adUnitPath;
    if (!adUnitPath) return { completed: false, payload: { granted: false } };
    const googletag = await loadGpt();

    return new Promise<RewardedAdResult>((resolve) => {
      googletag.cmd.push(() => {
        const slot = googletag.defineOutOfPageSlot(
          adUnitPath,
          googletag.enums.OutOfPageFormat.REWARDED,
        );
        if (!slot) {
          // Page/browser not eligible for rewarded ads.
          resolve({ completed: false, payload: { granted: false, reason: "unsupported" } });
          return;
        }
        slot.addService(googletag.pubads());
        let granted = false;
        const pubads = googletag.pubads();
        const cleanup = () => googletag.destroySlots([slot]);

        pubads.addEventListener("rewardedSlotReady", (e: any) => {
          if (e.slot === slot) e.makeRewardedVisible();
        });
        pubads.addEventListener("rewardedSlotGranted", (e: any) => {
          if (e.slot === slot) granted = true;
        });
        pubads.addEventListener("rewardedSlotClosed", (e: any) => {
          if (e.slot !== slot) return;
          cleanup();
          resolve({ completed: granted, payload: { granted } });
        });
        pubads.addEventListener("slotRenderEnded", (e: any) => {
          if (e.slot === slot && e.isEmpty) {
            cleanup();
            resolve({ completed: false, payload: { granted: false, reason: "no_fill" } });
          }
        });
        signal?.addEventListener("abort", () => {
          cleanup();
          resolve({ completed: false, payload: { granted: false } });
        });

        googletag.enableServices();
        googletag.display(slot);
      });
    });
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export function clientProviderFor(id: AdProviderId): ClientRewardedAdProvider {
  return id === "gam" ? gamClientProvider : mockClientProvider;
}
