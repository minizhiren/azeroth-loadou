import { requireInvite } from "@/lib/access";
import { getPackage, json, validId } from "@/lib/packages";
import { env } from "cloudflare:workers";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = requireInvite(request);
  if (denied) return denied;
  const { id } = await context.params;
  if (!validId(id)) return json({ error: "配置包编号无效" }, 400);
  const item = await getPackage(id);
  if (!item || item.status !== "ready") return json({ error: "配置包不存在" }, 404);
  await env.DB.prepare("UPDATE packages SET download_count = download_count + 1 WHERE id = ?").bind(id).run();
  return json({ package: item });
}
