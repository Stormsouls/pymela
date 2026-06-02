// Solo para uso en el servidor (API routes). Usa service_role para bypass de RLS.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Singleton por proceso (Next.js reutiliza el módulo en el mismo worker)
let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseServer() {
  if (!client) {
    client = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
  }
  return client;
}

const FREE_LIMIT = 9999; // sin límite por ahora

// Hash simple de IP para no guardar datos personales
async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ip + "pymela-salt-2026")
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export async function checkAndRecordGeneration(
  ip: string,
  botSlug: string
): Promise<{ allowed: boolean; used: number }> {
  if (!url || !serviceKey) {
    // Si no hay Supabase configurado, permitir (dev local)
    return { allowed: true, used: 0 };
  }

  const db = getSupabaseServer();
  const ipHash = await hashIp(ip);

  // Contar generaciones de las últimas 24h por este IP
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (db.from("generations") as any)
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);

  const used = count ?? 0;
  if (used >= FREE_LIMIT) {
    return { allowed: false, used };
  }

  // Registrar la generación
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.from("generations") as any).insert({ ip_hash: ipHash, bot_slug: botSlug });

  return { allowed: true, used: used + 1 };
}
