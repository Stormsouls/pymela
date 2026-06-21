import { createClient } from "@supabase/supabase-js";
import { createDecipheriv } from "crypto";
import fs from "fs";

// cargar .env.local manualmente
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

function decrypt(value) {
  if (!value || !value.startsWith("v1:")) return value;
  const [, ivB64, tagB64, dataB64] = value.split(":");
  const key = Buffer.from(env.ML_TOKEN_ENC_KEY, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: conns } = await db.from("ml_connections").select("*");
if (!conns?.length) { console.log("SIN conexiones ML"); process.exit(0); }
const conn = conns[0];
console.log("conexión:", conn.ml_nickname, conn.ml_user_id);

let token = decrypt(conn.access_token);
// refrescar si expiró
if (new Date(conn.token_expires_at).getTime() - Date.now() < 5 * 60 * 1000) {
  const r = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.ML_APP_ID ?? "",
      client_secret: env.ML_CLIENT_SECRET ?? "",
      refresh_token: decrypt(conn.refresh_token),
    }),
  });
  const j = await r.json();
  console.log("refresh:", r.status, j.access_token ? "ok" : JSON.stringify(j).slice(0, 200));
  if (j.access_token) token = j.access_token;
}

async function test(label, url) {
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const txt = await r.text();
    console.log(`\n### ${label} → ${r.status}`);
    console.log(txt.slice(0, 700));
  } catch (e) { console.log(`\n### ${label} → ERROR`, e.message); }
}

await test("SEARCH q=anillo inteligente", "https://api.mercadolibre.com/sites/MLA/search?q=anillo%20inteligente&limit=3");
await test("REVIEWS item", "https://api.mercadolibre.com/reviews/item/MLA1904213156");
await test("QUESTIONS item", "https://api.mercadolibre.com/questions/search?item_id=MLA1904213156&limit=5");
