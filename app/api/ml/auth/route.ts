import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/ml-api";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

// Redirige al usuario a la pantalla de autorización de MercadoLibre.
// El `state` contiene el user_id de Supabase para vincular la cuenta.
export async function GET(req: NextRequest) {
  // Intentar obtener el user_id de la sesión actual via el header de auth
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  let userId = req.nextUrl.searchParams.get("user_id") ?? "";

  if (!userId && token) {
    try {
      const db = getSupabaseServer();
      const { data } = await db.auth.getUser(token);
      userId = data.user?.id ?? "";
    } catch { /* ignorar */ }
  }

  // Codificar state como base64 para pasar el user_id al callback
  const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString("base64url");
  const url = buildAuthUrl(state);
  return NextResponse.redirect(url);
}
