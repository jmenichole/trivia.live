export type HostMode = "off" | "live_audio";

export function isHostUser(userId: string | undefined): boolean {
  if (!userId) return false;
  const ids = [
    ...(process.env.HOST_USER_IDS ?? "").split(","),
    ...(process.env.ADMIN_USER_IDS ?? "").split(","),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

export function roomNameForShow(showId: string): string {
  return `trivia-${showId}`;
}
