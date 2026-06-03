import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, mlFetch } from "@/lib/ml-api";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/conectar-ml?error=denied", req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/conectar-ml?error=no_code", req.url));
  }

  try {
    // Decodificar state para obtener el user_id de Supabase
    let userId = "";
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
      userId = decoded.userId ?? "";
    } catch { /* ignorar */ }

    // Intercambiar código por tokens
    const tokens = await exchangeCode(code);

    // Obtener datos del usuario de ML
    const mlUser = await mlFetch(`/users/${tokens.user_id}`, tokens.access_token);

    const db = getSupabaseServer();
    const mlUserId = String(tokens.user_id);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Si no tenemos userId de Supabase, lo buscamos por ml_user_id o creamos uno anónimo
    if (!userId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (db.from("ml_connections") as any)
        .select("user_id")
        .eq("ml_user_id", mlUserId)
        .single();
      userId = existing?.user_id ?? "";
    }

    if (!userId) {
      // Crear usuario anónimo en Supabase para este vendedor
      const { data } = await db.auth.admin.createUser({ email_confirm: true });
      userId = data.user?.id ?? "";
    }

    // Upsert en ml_connections
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from("ml_connections") as any).upsert({
      user_id: userId,
      ml_user_id: mlUserId,
      ml_nickname: mlUser.nickname ?? mlUser.first_name ?? "Vendedor",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: "ml_user_id" });

    return NextResponse.redirect(new URL("/conectar-ml?success=1", req.url));
  } catch (err) {
    console.error("[ml/callback]", err);
    return NextResponse.redirect(new URL("/conectar-ml?error=auth_failed", req.url));
  }
}
