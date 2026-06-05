import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

// GET — devuelve la conexión ML del usuario identificado por cookie pymela_ml_uid
export async function GET(req: NextRequest) {
  const mlUid = req.cookies.get("pymela_ml_uid")?.value;
  if (!mlUid) return NextResponse.json(null);

  const db = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db.from("ml_connections") as any)
    .select("id, ml_nickname, ml_user_id, auto_respond, review_mode, playbook, created_at")
    .eq("ml_user_id", mlUid)
    .single();
  return NextResponse.json(data ?? null);
}

// PATCH — actualiza campos de la conexión
export async function PATCH(req: NextRequest) {
  const mlUid = req.cookies.get("pymela_ml_uid")?.value;
  if (!mlUid) return NextResponse.json({ error: "No identificado" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  // Solo permitir actualizar estos campos seguros
  const allowed = ["auto_respond", "review_mode", "playbook"];
  const update: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) update[k] = body[k];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Sin campos válidos" }, { status: 400 });
  }

  const db = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.from("ml_connections") as any)
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("ml_user_id", mlUid);
  return NextResponse.json({ ok: true });
}

// DELETE — desconectar
export async function DELETE(req: NextRequest) {
  const mlUid = req.cookies.get("pymela_ml_uid")?.value;
  if (!mlUid) return NextResponse.json({ error: "No identificado" }, { status: 401 });

  const db = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.from("ml_connections") as any).delete().eq("ml_user_id", mlUid);

  const res = NextResponse.json({ ok: true });
  res.cookies.set("pymela_ml_uid", "", { path: "/", maxAge: 0 });
  return res;
}
