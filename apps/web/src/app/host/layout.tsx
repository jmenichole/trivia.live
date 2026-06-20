import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isHostUser } from "@/lib/hosts";

export default async function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  if (!supabase) redirect("/");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isHostUser(user?.id)) redirect("/");

  return <div className="host-layout">{children}</div>;
}
