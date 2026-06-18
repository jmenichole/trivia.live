"use client";

import { use } from "react";
import { useShowChannel } from "@/hooks/useShowChannel";
import { HostConsole } from "@/components/HostConsole";

export default function HostShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { state } = useShowChannel(id);
  return <HostConsole showId={id} state={state} />;
}
