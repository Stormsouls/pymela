import { NextRequest, NextResponse } from "next/server";
import { groq, DEFAULT_MODEL } from "@/lib/groq";
import { buildPrompt } from "@/lib/prompts";
import { getBot } from "@/lib/bots";
import { checkAndRecordGeneration } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { slug?: string; values?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { slug, values } = body;
  if (!slug || !values) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const bot = getBot(slug);
  if (!bot) {
    return NextResponse.json({ error: "Bot inexistente" }, { status: 404 });
  }

  // Validación mínima: campos requeridos presentes.
  for (const f of bot.fields) {
    if (f.required && !values[f.name]?.trim()) {
      return NextResponse.json(
        { error: `Falta completar: ${f.label}` },
        { status: 400 }
      );
    }
  }

  const spec = buildPrompt(slug, values);
  if (!spec) {
    return NextResponse.json({ error: "Bot sin prompt" }, { status: 500 });
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "El servidor no tiene configurada la API de IA." },
      { status: 503 }
    );
  }

  // Verificar límite free (3 generaciones / 24h por IP)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const { allowed, used } = await checkAndRecordGeneration(ip, slug);
  if (!allowed) {
    return NextResponse.json(
      {
        error: "Alcanzaste el límite gratuito (3 generaciones por día). Próximamente plan Pro.",
        limitReached: true,
        used,
      },
      { status: 429 }
    );
  }

  try {
    const completion = await groq.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: spec.temperature,
      max_tokens: spec.maxTokens,
      messages: [
        { role: "system", content: spec.system },
        { role: "user", content: spec.user },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return NextResponse.json({ error: "La IA no devolvió respuesta" }, { status: 502 });
    }

    return NextResponse.json({ text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[generate]", msg);
    return NextResponse.json(
      { error: "Error al generar. Probá de nuevo en unos segundos." },
      { status: 502 }
    );
  }
}
