import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, mlFetch } from "@/lib/ml-api";
import { getSupabaseServer } from "@/lib/supabase-server";
import { ML_COOKIE_NAME, ML_COOKIE_OPTIONS, makeMlCookieValue } from "@/lib/ml-session";
import { encrypt } from "@/lib/crypto";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const error = req.nextUrl.searchParams.get("error");

  if (error) return NextResponse.redirect(new URL("/conectar-ml?error=denied", req.url));
  if (!code) return NextResponse.redirect(new URL("/conectar-ml?error=no_code", req.url));

  // Validación anti-CSRF: el nonce del state debe coincidir con la cookie.
  let stateNonce = "";
  let userId = "";
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    stateNonce = decoded.nonce ?? "";
    userId = decoded.userId ?? "";
  } catch { /* state inválido */ }

  const cookieNonce = req.cookies.get("ml_oauth_state")?.value ?? "";
  if (!stateNonce || !cookieNonce || stateNonce !== cookieNonce) {
    return NextResponse.redirect(new URL("/conectar-ml?error=" + encodeURIComponent("Sesión de autorización inválida. Intentá de nuevo."), req.url));
  }

  try {
    const tokens = await exchangeCode(code);
    const mlUser = await mlFetch(`/users/${tokens.user_id}`, tokens.access_token);
    const db = getSupabaseServer();
    const mlUserId = String(tokens.user_id);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Si no hay userId, buscar conexión existente
    if (!userId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (db.from("ml_connections") as any)
        .select("user_id").eq("ml_user_id", mlUserId).single();
      userId = existing?.user_id ?? "";
    }

    // Si aún no hay userId, crear uno con email interno para vincular
    if (!userId) {
      const internalEmail = `ml_${mlUserId}@pymela.internal`;
      const { data, error: cErr } = await db.auth.admin.createUser({
        email: internalEmail,
        email_confirm: true,
        user_metadata: { ml_user_id: mlUserId },
      });
      if (!cErr && data.user) {
        userId = data.user.id;
      } else {
        // Ya existe — buscarlo por email
        const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
        const found = list?.users?.find((u) => u.email === internalEmail);
        if (found) userId = found.id;
      }
    }

    if (!userId) throw new Error("No se pudo crear/encontrar usuario Supabase");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertErr } = await (db.from("ml_connections") as any).upsert({
      user_id: userId,
      ml_user_id: mlUserId,
      ml_nickname: mlUser.nickname ?? mlUser.first_name ?? "Vendedor",
      access_token: encrypt(tokens.access_token),
      refresh_token: encrypt(tokens.refresh_token ?? ""),
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: "ml_user_id" });
    if (upsertErr) throw new Error(`DB upsert failed: ${upsertErr.message}`);

    // Guardar cookie de sesión FIRMADA — el ml_user_id es público, así que sin
    // firma cualquiera podría falsificarla y tomar control de otra cuenta.
    const redirect = NextResponse.redirect(new URL("/conectar-ml?success=1", req.url));
    redirect.cookies.set(ML_COOKIE_NAME, makeMlCookieValue(mlUserId), ML_COOKIE_OPTIONS);
    redirect.cookies.set("ml_oauth_state", "", { path: "/", maxAge: 0 });
    return redirect;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ml/callback]", msg);
    const url = new URL("/conectar-ml", req.url);
    url.searchParams.set("error", encodeURIComponent(msg).slice(0, 200));
    return NextResponse.redirect(url);
  }
}
