// Rate-limit anti-abuso por IP, respaldado en Supabase (sirve en serverless
// donde no hay estado en memoria compartido entre instancias).
import { getSupabaseServer, hashIp } from "./supabase-server";

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// Devuelve true si la request está permitida; false si superó el límite.
export async function rateLimit(
  ip: string,
  bucket: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const db = getSupabaseServer();
  const ipHash = await hashIp(ip);
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (db.from("rate_events") as any)
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .eq("bucket", bucket)
    .gte("created_at", since);

  if ((count ?? 0) >= max) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.from("rate_events") as any).insert({ ip_hash: ipHash, bucket });
  return true;
}
