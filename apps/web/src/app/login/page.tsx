import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isAdminUser, isHostOrAdminUser, safeNextPath } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  auth_failed: "Sign-in failed or the link expired. Try again.",
  not_configured: "Sign-in isn't configured on this server yet.",
  forbidden:
    "You're signed in, but this account isn't on the admin/host list.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNextPath(rawNext);

  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  return (
    <main>
      <h1 className="title">Sign in</h1>
      <p className="subtitle">
        Sign in to keep your points, earn referral extra lives, and be
        eligible for prizes. Hosts and admins sign in here too.
      </p>

      {error && ERRORS[error] && <p className="admin-error">{ERRORS[error]}</p>}

      {!isSupabaseConfigured() ? (
        <p className="admin-error">{ERRORS.not_configured}</p>
      ) : user ? (
        <div className="show-card">
          <p className="show-label">Signed in</p>
          <p>{user.email ?? user.user_metadata?.full_name ?? user.id}</p>
          <p className="subtitle login-userid">User ID: {user.id}</p>
          <div className="login-links">
            {isAdminUser(user.id) && (
              <a className="btn" href="/admin">
                Admin
              </a>
            )}
            {isHostOrAdminUser(user.id) && !isAdminUser(user.id) && (
              <p className="subtitle">
                You have host access. Open the host console link an admin
                shares with you (/host/show/&lt;show id&gt;).
              </p>
            )}
            {next !== "/" && (
              <a className="btn btn-ghost" href={next}>
                Continue
              </a>
            )}
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn btn-ghost">
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <LoginForm next={next} />
      )}
    </main>
  );
}
