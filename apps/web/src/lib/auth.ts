/**
 * Role checks for admins and hosts.
 *
 * ADMIN_USER_IDS / HOST_USER_IDS are comma-separated Supabase auth user
 * UUIDs (Authentication → Users in the Supabase dashboard). Admins are
 * always hosts.
 */
function idList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdminUser(userId: string | undefined | null): boolean {
  if (!userId) return false;
  return idList(process.env.ADMIN_USER_IDS).includes(userId);
}

export function isHostOrAdminUser(userId: string | undefined | null): boolean {
  if (!userId) return false;
  return (
    isAdminUser(userId) || idList(process.env.HOST_USER_IDS).includes(userId)
  );
}

/** Only allow same-site relative redirects after sign-in. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
