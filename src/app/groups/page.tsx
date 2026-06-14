import { listSpaces } from "@/lib/services/spaces";
import { isConfigured } from "@/lib/supabaseServer";
import SpacesList from "@/components/spaces/SpacesList";
import SetupNotice from "@/components/SetupNotice";

// Balances change whenever anyone in a space logs an expense — always fresh.
export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  if (!isConfigured()) return <SetupNotice />;
  const res = await listSpaces();
  const spaces = res.ok ? res.data : [];
  return <SpacesList initialSpaces={spaces} />;
}
