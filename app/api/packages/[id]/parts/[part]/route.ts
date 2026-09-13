import { env } from "cloudflare:workers";
import { requireInvite } from "@/lib/access";
import { getPackage, json, validId } from "@/lib/packages";

const MAX_PART_BYTES = 65 * 1024 * 1024;

export async function PUT(request: Request, context: { params: Promise<{ id: string; part: string }> }) {
  const denied = requireInvite(request);
  if (denied) return denied;
  const { id, part } = await context.params;
  const partIndex = Number(part);
  if (!validId(id) || !Number.isInteger(partIndex)) return json({ error: "分片编号无效" }, 400);
  const item = await getPackage(id);
  if (!item || item.status !== "uploading" || partIndex < 0 || partIndex >= item.total_parts) {
    return json({ error: "上传任务不存在" }, 404);
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (!request.body || contentLength <= 0 || contentLength > MAX_PART_BYTES) {
    return json({ error: "分片大小无效" }, 400);
  }
  await env.BUCKET.put(`packages/${id}/${partIndex}`, request.body, {
    httpMetadata: { contentType: "application/octet-stream" },
  });
  return json({ ok: true, part: partIndex });
}

export async function GET(request: Request, context: { params: Promise<{ id: string; part: string }> }) {
  const denied = requireInvite(request);
  if (denied) return denied;
  const { id, part } = await context.params;
  const partIndex = Number(part);
  if (!validId(id) || !Number.isInteger(partIndex)) return json({ error: "分片编号无效" }, 400);
  const item = await getPackage(id);
  if (!item || item.status !== "ready" || partIndex < 0 || partIndex >= item.total_parts) {
    return json({ error: "配置包不存在" }, 404);
  }
  const object = await env.BUCKET.get(`packages/${id}/${partIndex}`);
  if (!object) return json({ error: "分片不存在" }, 404);
  return new Response(object.body, {
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(object.size),
      "cache-control": "private, no-store",
    },
  });
}
