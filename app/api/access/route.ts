import { requireInvite } from "@/lib/access";
import { json } from "@/lib/packages";

export async function POST(request: Request) {
  const denied = requireInvite(request);
  if (denied) return denied;
  return json({ ok: true });
}
