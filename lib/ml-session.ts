// Cookie de sesión ML firmada con HMAC.
// El ml_user_id es público (aparece en URLs de ML), así que NO alcanza con
// guardarlo en una cookie: hay que firmarlo para que no se pueda falsificar.
import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

const COOKIE = "pymela_ml_uid";
// Reutilizamos un secreto que ya vive solo en el servidor.
const SECRET = process.env.ML_CLIENT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function sign(uid: string): string {
  return createHmac("sha256", SECRET).update(uid).digest("base64url");
}

// Valor a guardar en la cookie: "<uid>.<firma>"
export function makeMlCookieValue(uid: string): string {
  return `${uid}.${sign(uid)}`;
}

export const ML_COOKIE_NAME = COOKIE;

export const ML_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
};

// Devuelve el ml_user_id solo si la firma es válida; si no, null.
export function getVerifiedMlUid(req: NextRequest): string | null {
  const raw = req.cookies.get(COOKIE)?.value;
  if (!raw) return null;
  const idx = raw.lastIndexOf(".");
  if (idx <= 0) return null;
  const uid = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expected = sign(uid);
  if (sig.length !== expected.length) return null;
  try {
    if (timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return uid;
  } catch { /* longitudes distintas, etc. */ }
  return null;
}
