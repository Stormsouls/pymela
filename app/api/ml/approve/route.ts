import { NextRequest, NextResponse } from "next/server";
import { getFreshToken, postAnswer } from "@/lib/ml-api";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getVerifiedMlUid } from "@/lib/ml-session";

export const runtime = "nodejs";

// POST /api/ml/approve — aprueba o rechaza un borrador
// body: { draft_id, action: "approve" | "reject" | "edit", edited_text? }
export async function POST(req: NextRequest) {
  let body: { draft_id?: string; action?: string; edited_text?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const mlUid = getVerifiedMlUid(req);
  if (!mlUid) return NextResponse.json({ error: "No identificado" }, { status: 401 });

  const { draft_id, action, edited_text } = body;
  if (!draft_id || !action) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const db = getSupabaseServer();

  // Obtener el borrador
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: draft, error } = await (db.from("ml_drafts") as any)
    .select("*, ml_connections(ml_user_id, access_token, refresh_token, token_expires_at, id, user_id)")
    .eq("id", draft_id)
    .eq("status", "pending")
    .single();

  if (error || !draft) {
    return NextResponse.json({ error: "Borrador no encontrado" }, { status: 404 });
  }

  // Verificar que el borrador pertenece a la cuenta de la cookie firmada
  if (draft.ml_connections?.ml_user_id !== mlUid) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (action === "reject") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from("ml_drafts") as any)
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", draft_id);
    return NextResponse.json({ ok: true });
  }

  // approve o edit
  const responseText = (action === "edit" && edited_text?.trim())
    ? edited_text.trim()
    : draft.draft_response;

  try {
    const conn = draft.ml_connections;
    const token = await getFreshToken(conn);
    await postAnswer(Number(draft.question_id), responseText, token);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from("ml_drafts") as any)
      .update({
        status: action === "edit" ? "edited" : "approved",
        final_response: responseText,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", draft_id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
