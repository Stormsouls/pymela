import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getVerifiedMlUid } from "@/lib/ml-session";

export const runtime = "nodejs";

// PATCH — upsert configuración de una publicación específica
export async function PATCH(req: NextRequest) {
  const mlUid = getVerifiedMlUid(req);
  if (!mlUid) return NextResponse.json({ error: "No identificado" }, { status: 401 });

  let body: { item_id?: string; active?: boolean; custom_playbook?: string; title?: string; thumbnail?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  if (!body.item_id) return NextResponse.json({ error: "item_id requerido" }, { status: 400 });

  const upsertData: Record<string, unknown> = { ml_user_id: mlUid, item_id: body.item_id };
  if (body.active !== undefined) upsertData.active = body.active;
  if (body.custom_playbook !== undefined) upsertData.custom_playbook = body.custom_playbook;
  if (body.title !== undefined) upsertData.title = body.title;
  if (body.thumbnail !== undefined) upsertData.thumbnail = body.thumbnail;

  const db = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.from("ml_item_settings") as any)
    .upsert(upsertData, { onConflict: "ml_user_id,item_id" });

  return NextResponse.json({ ok: true });
}
