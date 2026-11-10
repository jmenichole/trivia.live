import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isHostUser } from "@/lib/hosts";

export default async function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  if (!supabase) redirect("/login?error=not_configured");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  if (!isHostUser(user.id)) redirect("/login?error=forbidden");

  return <div className="host-layout">{children}</div>;
}
