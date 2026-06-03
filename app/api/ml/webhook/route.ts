import { NextRequest, NextResponse } from "next/server";
import {
  getConnectionByMlUserId,
  getFreshToken,
  getQuestion,
  getItem,
  postAnswer,
} from "@/lib/ml-api";
import { groq, DEFAULT_MODEL } from "@/lib/groq";

export const runtime = "nodejs";

// ML requiere respuesta 200 inmediata — procesamos en background con waitUntil si está disponible.
// En Vercel serverless la función se mantiene viva hasta que completa aunque ya enviemos el 200.

export async function POST(req: NextRequest) {
  let body: {
    _id?: string;
    resource?: string;
    user_id?: number;
    topic?: string;
    application_id?: number;
  };

  try {
    body = await req.json();
  } catch {
    return new NextResponse("ok", { status: 200 });
  }

  // Solo procesar notificaciones de preguntas
  if (body.topic !== "questions" && !body.resource?.includes("questions")) {
    return new NextResponse("ok", { status: 200 });
  }

  // Extraer question ID del resource path (/questions/123456)
  const questionId = body.resource?.split("/").pop();
  const mlUserId = String(body.user_id ?? "");

  if (!questionId || !mlUserId) {
    return new NextResponse("ok", { status: 200 });
  }

  // Responder 200 de inmediato — ML no espera más de 500ms
  // El procesamiento async ocurre en el mismo request lifecycle de Vercel
  processQuestion(questionId, mlUserId).catch((err) =>
    console.error("[ml/webhook] error procesando pregunta:", err)
  );

  return new NextResponse("ok", { status: 200 });
}

async function processQuestion(questionId: string, mlUserId: string) {
  // 1. Buscar la conexión del vendedor
  const conn = await getConnectionByMlUserId(mlUserId);
  if (!conn || !conn.auto_respond) return;

  // 2. Obtener token fresco
  const token = await getFreshToken(conn);

  // 3. Obtener la pregunta
  const question = await getQuestion(questionId, token);

  // Solo responder preguntas sin respuesta
  if (question.status !== "UNANSWERED" || question.answer) return;

  // 4. Obtener datos del producto para dar contexto a la IA
  let productContext = "";
  try {
    const item = await getItem(question.item_id, token);
    const attrs = (item.attributes ?? [])
      .slice(0, 10)
      .map((a) => `${a.name}: ${a.value_name}`)
      .join(", ");
    productContext =
      `Producto: ${item.title}` +
      (item.warranty ? ` | Garantía: ${item.warranty}` : "") +
      (attrs ? ` | ${attrs}` : "");
  } catch {
    productContext = `Item ID: ${question.item_id}`;
  }

  // 5. Generar respuesta con Groq
  const completion = await groq.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.65,
    max_tokens: 300,
    messages: [
      {
        role: "system",
        content:
          "Sos un vendedor profesional de MercadoLibre en Latinoamérica. " +
          "Respondés preguntas de compradores de forma clara, breve y que incentive la compra. " +
          "Nunca inventás información que no tenés. Si no sabés algo, lo decís honestamente y ofrecés más info. " +
          "Siempre terminás con algo que facilite el cierre. Máximo 3 oraciones. " +
          "Escribís en español neutro latinoamericano, sin markdown.",
      },
      {
        role: "user",
        content: `${productContext}\n\nPregunta del comprador: "${question.text}"\n\nEscribí UNA respuesta lista para publicar en MercadoLibre.`,
      },
    ],
  });

  const answer = completion.choices[0]?.message?.content?.trim();
  if (!answer) return;

  // 6. Publicar la respuesta en ML
  await postAnswer(question.id, answer, token);

  console.log(`[ml/webhook] Respondida pregunta ${questionId} para usuario ML ${mlUserId}`);
}
