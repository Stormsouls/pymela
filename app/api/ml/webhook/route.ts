import { NextRequest, NextResponse } from "next/server";
import {
  getConnectionByMlUserId,
  getFreshToken,
  getQuestion,
  getItem,
  postAnswer,
  type MlConnection,
} from "@/lib/ml-api";
import { groq, DEFAULT_MODEL } from "@/lib/groq";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { _id?: string; resource?: string; user_id?: number; topic?: string };
  try { body = await req.json(); } catch {
    return new NextResponse("ok", { status: 200 });
  }

  if (body.topic !== "questions" && !body.resource?.includes("questions")) {
    return new NextResponse("ok", { status: 200 });
  }

  const questionId = body.resource?.split("/").pop();
  const mlUserId = String(body.user_id ?? "");
  if (!questionId || !mlUserId) return new NextResponse("ok", { status: 200 });

  // Respuesta inmediata — ML no espera
  processQuestion(questionId, mlUserId).catch((err) =>
    console.error("[ml/webhook]", err instanceof Error ? err.message : err)
  );

  return new NextResponse("ok", { status: 200 });
}

async function processQuestion(questionId: string, mlUserId: string) {
  const conn = await getConnectionByMlUserId(mlUserId);
  if (!conn || !conn.auto_respond) return;

  const token = await getFreshToken(conn);
  const question = await getQuestion(questionId, token);
  if (question.status !== "UNANSWERED" || question.answer) return;

  // Verificar si esta publicación tiene el bot desactivado
  const db = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: itemSetting } = await (db.from("ml_item_settings") as any)
    .select("active, custom_playbook")
    .eq("ml_user_id", mlUserId)
    .eq("item_id", question.item_id)
    .maybeSingle();

  if (itemSetting && !itemSetting.active) return;

  // Contexto del producto
  let itemTitle = question.item_id;
  let productContext = `Producto (ID: ${question.item_id})`;
  try {
    const item = await getItem(question.item_id, token);
    itemTitle = item.title;
    const attrs = (item.attributes ?? []).slice(0, 12)
      .filter((a) => a.value_name)
      .map((a) => `${a.name}: ${a.value_name}`)
      .join(" | ");
    productContext =
      `Producto: ${item.title}` +
      (item.condition === "used" ? " (usado)" : " (nuevo)") +
      (item.warranty ? ` | Garantía: ${item.warranty}` : "") +
      (attrs ? `\nEspecificaciones: ${attrs}` : "");
  } catch { /* seguir con ID */ }

  // Construir prompt con playbook del vendedor
  const playbook = (conn as MlConnection & { playbook?: string }).playbook?.trim() ?? "";
  const systemPrompt =
    "Sos el asistente de ventas de un vendedor de MercadoLibre en Latinoamérica. " +
    "Tu única tarea es responder preguntas de compradores de forma clara, breve y que incentive la compra. " +
    "Nunca inventás datos que no tenés — si no sabés algo, lo decís y ofrecés consultar. " +
    "Máximo 3 oraciones. Sin markdown. Español neutro latinoamericano." +
    (playbook ? `\n\nINSTRUCCIONES DEL VENDEDOR:\n${playbook}` : "");

  const completion = await groq.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.6,
    max_tokens: 300,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `${productContext}\n\nPregunta del comprador: "${question.text}"\n\nEscribí UNA respuesta lista para publicar.`,
      },
    ],
  });

  const answer = completion.choices[0]?.message?.content?.trim();
  if (!answer) return;

  const reviewMode = (conn as MlConnection & { review_mode?: boolean }).review_mode ?? false;

  if (reviewMode) {
    // Guardar como borrador para que el vendedor revise
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from("ml_drafts") as any).insert({
      ml_conn_id: conn.id,
      user_id: conn.user_id,
      question_id: questionId,
      question_text: question.text,
      item_id: question.item_id,
      item_title: itemTitle,
      draft_response: answer,
      status: "pending",
    });
    console.log(`[ml/webhook] Borrador guardado para revisión: pregunta ${questionId}`);
  } else {
    // Publicar directamente
    await postAnswer(question.id, answer, token);
    console.log(`[ml/webhook] Respondida automáticamente: pregunta ${questionId}`);
  }
}
