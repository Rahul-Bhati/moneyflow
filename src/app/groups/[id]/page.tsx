import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { getSpace } from "@/lib/services/spaces";
import { isConfigured } from "@/lib/supabaseServer";
import SpaceDetail from "@/components/spaces/SpaceDetail";
import SetupNotice from "@/components/SetupNotice";

export const dynamic = "force-dynamic";

export default async function SpacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isConfigured()) return <SetupNotice />;
  const { id } = await params;
  const { userId } = await auth();
  const res = await getSpace(id);
  if (!res.ok) notFound();
  return <SpaceDetail detail={res.data} meId={userId ?? ""} />;
}
