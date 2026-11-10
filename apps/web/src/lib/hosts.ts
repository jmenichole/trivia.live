import { isHostOrAdminUser } from "./auth";

export type HostMode = "off" | "live_audio";

export function isHostUser(userId: string | undefined): boolean {
  return isHostOrAdminUser(userId);
}

export function roomNameForShow(showId: string): string {
  return `trivia-${showId}`;
}
