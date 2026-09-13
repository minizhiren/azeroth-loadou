import { env } from "cloudflare:workers";
import { requireInvite } from "@/lib/access";
import { getPackage, json, validId } from "@/lib/packages";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = requireInvite(request);
  if (denied) return denied;
  const { id } = await context.params;
  if (!validId(id)) return json({ error: "配置包编号无效" }, 400);
  const item = await getPackage(id);
  if (!item || item.status !== "uploading") return json({ error: "上传任务不存在" }, 404);

  let totalBytes = 0;
  for (let index = 0; index < item.total_parts; index += 1) {
    const part = await env.BUCKET.head(`packages/${id}/${index}`);
    if (!part) return json({ error: `缺少第 ${index + 1} 个分片` }, 409);
    totalBytes += part.size;
  }
  if (totalBytes !== item.size_bytes) return json({ error: "配置包大小校验失败" }, 409);
  await env.DB.prepare("UPDATE packages SET status = 'ready' WHERE id = ?").bind(id).run();
  return json({ ok: true, id });
}
