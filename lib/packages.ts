import { env } from "cloudflare:workers";

export type PackageRow = {
  id: string;
  name: string;
  uploader: string;
  note: string;
  game_version: string;
  size_bytes: number;
  total_parts: number;
  sha256: string;
  status: string;
  download_count: number;
  created_at: number;
};

export async function getPackage(id: string) {
  return env.DB.prepare("SELECT * FROM packages WHERE id = ?")
    .bind(id)
    .first<PackageRow>();
}

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function validId(value: string) {
  return /^[a-f0-9-]{36}$/.test(value);
}
