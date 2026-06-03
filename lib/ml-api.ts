// MercadoLibre API helpers — solo se importan en el servidor.
import { getSupabaseServer } from "./supabase-server";

const ML_BASE = "https://api.mercadolibre.com";
const APP_ID = process.env.ML_APP_ID!;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET!;

// ─── Token management ────────────────────────────────────────────────────────

export type MlConnection = {
  id: string;
  user_id: string;
  ml_user_id: string;
  ml_nickname: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  auto_respond: boolean;
};

export async function getConnectionByMlUserId(mlUserId: string): Promise<MlConnection | null> {
  const db = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db.from("ml_connections") as any)
    .select("*")
    .eq("ml_user_id", mlUserId)
    .single();
  return data ?? null;
}

export async function getConnectionByUserId(userId: string): Promise<MlConnection | null> {
  const db = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db.from("ml_connections") as any)
    .select("*")
    .eq("user_id", userId)
    .single();
  return data ?? null;
}

// Refresca el token si expira en menos de 5 minutos
export async function getFreshToken(conn: MlConnection): Promise<string> {
  const expiresAt = new Date(conn.token_expires_at).getTime();
  const now = Date.now();
  if (expiresAt - now > 5 * 60 * 1000) return conn.access_token;

  // Refrescar
  const res = await fetch(`${ML_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: APP_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: conn.refresh_token,
    }),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const data = await res.json();

  const db = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.from("ml_connections") as any)
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? conn.refresh_token,
      token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    })
    .eq("id", conn.id);

  return data.access_token;
}

// ─── API calls ───────────────────────────────────────────────────────────────

export async function mlFetch(path: string, token: string, options?: RequestInit) {
  const res = await fetch(`${ML_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.status.toString());
    throw new Error(`ML API ${path} → ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

export type MlQuestion = {
  id: number;
  item_id: string;
  seller_id: number;
  status: string;
  text: string;
  answer?: { text: string; status: string };
  from?: { id: number; answered_questions?: number };
};

export async function getQuestion(questionId: string, token: string): Promise<MlQuestion> {
  return mlFetch(`/questions/${questionId}`, token);
}

export type MlItem = {
  id: string;
  title: string;
  category_id: string;
  price: number;
  currency_id: string;
  condition: string;
  listing_type_id: string;
  attributes: Array<{ name: string; value_name: string }>;
  warranty?: string;
};

export async function getItem(itemId: string, token: string): Promise<MlItem> {
  return mlFetch(`/items/${itemId}`, token);
}

export async function postAnswer(questionId: number, text: string, token: string): Promise<void> {
  await mlFetch("/answers", token, {
    method: "POST",
    body: JSON.stringify({ question_id: questionId, text }),
  });
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: APP_ID,
    redirect_uri: "https://pymela.vercel.app/api/ml/callback",
    state,
  });
  return `https://auth.mercadolibre.com.ar/authorization?${params}`;
}

export async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: number;
}> {
  const res = await fetch(`${ML_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: APP_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: "https://pymela.vercel.app/api/ml/callback",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json();
}
