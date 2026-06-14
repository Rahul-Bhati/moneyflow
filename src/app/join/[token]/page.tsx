import { redirect } from "next/navigation";
import { acceptInvite } from "@/lib/services/spaces";

// Invite landing. The proxy already gated this behind sign-in, so by the time
// we run, the user is authenticated. Accept the invite, then bounce into the
// space (or back to the list with an error flag).
export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await acceptInvite(token);
  if (res.ok) redirect(`/groups/${res.data.space_id}`);
  redirect(`/groups?join_error=1`);
}
