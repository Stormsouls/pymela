import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
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

  // Nonce anti-CSRF: se guarda en cookie y se valida en el callback, para que
  // un atacante no pueda forzar un flujo OAuth con un state que él controla.
  const nonce = randomUUID();
  const state = Buffer.from(JSON.stringify({ userId, ts: Date.now(), nonce })).toString("base64url");
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set("ml_oauth_state", nonce, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutos para completar el login
  });
  return res;
}
