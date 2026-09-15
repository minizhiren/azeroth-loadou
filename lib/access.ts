import { env } from "cloudflare:workers";

const encoder = new TextEncoder();

function constantTimeEqual(left: string, right: string) {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const size = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let index = 0; index < size; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

export function getInviteCode(request: Request) {
  const header = request.headers.get("x-invite-code")?.trim();
  if (header) return header;
  return new URL(request.url).searchParams.get("code")?.trim() ?? "";
}

export function requireInvite(request: Request) {
  const configured = env.WOWSYNC_INVITE_CODE;
  if (!configured || !constantTimeEqual(getInviteCode(request), configured)) {
    return new Response(JSON.stringify({ error: "邀请码无效" }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  return null;
}
