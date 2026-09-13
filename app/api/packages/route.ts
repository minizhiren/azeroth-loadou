import { env } from "cloudflare:workers";
import { requireInvite } from "@/lib/access";
import { json } from "@/lib/packages";

const MAX_PACKAGE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_PARTS = 32;

export async function GET(request: Request) {
  const denied = requireInvite(request);
  if (denied) return denied;
  const result = await env.DB.prepare(
    `SELECT id, name, uploader, note, game_version, size_bytes, total_parts,
            sha256, status, download_count, created_at
       FROM packages
      WHERE status = 'ready'
      ORDER BY created_at DESC
      LIMIT 100`,
  ).all();
  return json({ packages: result.results });
}

export async function POST(request: Request) {
  const denied = requireInvite(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = String(body?.name ?? "").trim().slice(0, 80);
  const uploader = String(body?.uploader ?? "").trim().slice(0, 40);
  const note = String(body?.note ?? "").trim().slice(0, 240);
  const sha256 = String(body?.sha256 ?? "").toLowerCase();
  const sizeBytes = Number(body?.sizeBytes);
  const totalParts = Number(body?.totalParts);

  if (!name || !uploader || !/^[a-f0-9]{64}$/.test(sha256)) {
    return json({ error: "配置包信息不完整" }, 400);
  }
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_PACKAGE_BYTES) {
    return json({ error: "配置包必须小于 2 GB" }, 400);
  }
  if (!Number.isInteger(totalParts) || totalParts < 1 || totalParts > MAX_PARTS) {
    return json({ error: "分片数量无效" }, 400);
  }
  if (totalParts !== Math.ceil(sizeBytes / (64 * 1024 * 1024))) {
    return json({ error: "分片数量与配置包大小不匹配" }, 400);
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO packages
      (id, name, uploader, note, game_version, size_bytes, total_parts, sha256, status, download_count, created_at)
     VALUES (?, ?, ?, ?, 'retail', ?, ?, ?, 'uploading', 0, ?)`,
  )
    .bind(id, name, uploader, note, sizeBytes, totalParts, sha256, Date.now())
    .run();

  return json({ id, partSize: 64 * 1024 * 1024 }, 201);
}
