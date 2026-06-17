import { NextRequest, NextResponse } from "next/server";
import { groq, DEFAULT_MODEL } from "@/lib/groq";
import { buildPrompt } from "@/lib/prompts";
import { getBot } from "@/lib/bots";
import { checkAndRecordGeneration } from "@/lib/supabase-server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const ML_TITLE_MAX = 60;

// Recorta un título en el límite de palabra más cercano a 60 chars (último recurso).
function hardTruncate(title: string): string {
  if (title.length <= ML_TITLE_MAX) return title;
  const cut = title.slice(0, ML_TITLE_MAX + 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 30 ? cut.slice(0, lastSpace) : cut.slice(0, ML_TITLE_MAX)).trim();
}

// Los LLM cuentan mal caracteres: validamos los títulos de ML y, si alguno se pasa
// de 60, lo acortamos con una segunda pasada barata (fallback: truncado por palabra).
async function enforceMlTitleLimit(text: string): Promise<string> {
  const lines = text.split("\n");

  // Índices de líneas que contienen títulos: la línea siguiente no vacía a "TÍTULO"
  // y las numeradas bajo "TÍTULOS ALTERNATIVOS".
  const titleIdx: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const header = lines[i].trim();
    if (header === "TÍTULO" || header === "TITULO") {
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim()) { titleIdx.push(j); break; }
      }
    } else if (header.startsWith("TÍTULOS ALTERNATIVOS") || header.startsWith("TITULOS ALTERNATIVOS")) {
      for (let j = i + 1; j < lines.length && titleIdx.length < 6; j++) {
        const m = lines[j].trim();
        if (!m) continue;
        if (/^\d+[.)]\s/.test(m)) titleIdx.push(j);
        else break;
      }
    }
  }
  if (titleIdx.length === 0) return text;

  const cleanTitle = (line: string) => line.trim().replace(/^\d+[.)]\s*/, "").replace(/^\[|\]$/g, "").trim();
  const tooLong = titleIdx.filter((i) => cleanTitle(lines[i]).length > ML_TITLE_MAX);
  if (tooLong.length === 0) return text;

  let shortened: string[] | null = null;
  try {
    const fix = await groq.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: 0.2,
      max_tokens: 250,
      messages: [
        {
          role: "system",
          content:
            "Acortás títulos de publicaciones de MercadoLibre a 60 caracteres como máximo. " +
            "Conservás las palabras clave más buscadas al principio y eliminás lo menos importante. " +
            "Devolvés SOLO los títulos acortados, uno por línea, en el mismo orden, sin numeración ni comentarios.",
        },
        { role: "user", content: tooLong.map((i) => cleanTitle(lines[i])).join("\n") },
      ],
    });
    const out = (fix.choices[0]?.message?.content ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
    if (out.length === tooLong.length) shortened = out;
  } catch { /* fallback abajo */ }

  tooLong.forEach((lineIdx, k) => {
    const candidate = shortened?.[k] && shortened[k].length <= ML_TITLE_MAX ? shortened[k] : hardTruncate(cleanTitle(lines[lineIdx]));
    const numbering = lines[lineIdx].trim().match(/^\d+[.)]\s*/)?.[0] ?? "";
    lines[lineIdx] = numbering + candidate;
  });

  return lines.join("\n");
}

// ── Limpieza defensiva del output de descripciones ───────────────────────────
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2705}\u{2728}]/u;
const GLOBAL_HEADERS = /^(TÍTULO|TITULO|TÍTULOS ALTERNATIVOS|TITULOS ALTERNATIVOS|DESCRIPCIÓN|DESCRIPCION|FICHA TÉCNICA|FICHA TECNICA|PALABRAS CLAVE SEO)\b/;

// Bullets de contenido (no son encabezados de sección).
function isContentBullet(t: string): boolean {
  return /^(✅|🔹|•|-|\d+[.)])/u.test(t);
}

// Encabezado de sección de la descripción: empieza con emoji y no es un bullet.
const STARTS_WITH_EMOJI = new RegExp(`^${EMOJI_RE.source}`, "u");
function isSectionHeader(t: string): boolean {
  return !!t && !isContentBullet(t) && STARTS_WITH_EMOJI.test(t);
}

// ¿El encabezado trae su contenido en la misma línea? (ej: "🛡️ GARANTÍA — 12 meses")
function headerHasInlineContent(line: string): boolean {
  const s = line
    .replace(new RegExp(EMOJI_RE.source, "gu"), " ")
    .replace(/[A-ZÁÉÍÓÚÑ¿?¡!—:|]/g, " ");
  return /[a-záéíóúñ0-9]{2,}/.test(s);
}

// Elimina encabezados de sección con emoji que quedaron sin contenido, filas de
// ficha con marcadores residuales ([completar]/N/A/vacío) y colapsa líneas en blanco.
function cleanMlOutput(text: string): string {
  const lines = text.split("\n");
  const drop = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;

    // Encabezado de sección huérfano
    if (isSectionHeader(t) && !GLOBAL_HEADERS.test(t) && !headerHasInlineContent(t)) {
      let bodyHasContent = false;
      let j = i + 1;
      for (; j < lines.length; j++) {
        const b = lines[j].trim();
        if (!b) continue;
        if (GLOBAL_HEADERS.test(b) || (isSectionHeader(b) && !isContentBullet(b))) break;
        if (/[a-záéíóúñ0-9]/.test(b)) { bodyHasContent = true; break; }
      }
      if (!bodyHasContent) drop.add(i);
      continue;
    }

    // Fila de ficha con marcador residual: "Atributo: [completar]" / "Atributo:" / "Atributo: N/A"
    if (/^[\wÁÉÍÓÚÑáéíóúñ .]{2,30}:\s*(\[?completar\]?|n\/?a|-{1,2})?\s*$/i.test(lines[i]) && /:/.test(lines[i])) {
      const val = lines[i].split(":").slice(1).join(":").trim();
      if (!val || /^(\[?completar\]?|n\/?a|-{1,2})$/i.test(val)) drop.add(i);
    }
  }

  return lines
    .filter((_, i) => !drop.has(i))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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

  // Cota de tamaño de entrada: evita prompts gigantes que disparen el costo de IA.
  if (JSON.stringify(values).length > 20_000) {
    return NextResponse.json({ error: "El contenido es demasiado largo." }, { status: 413 });
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

  const ip = getClientIp(req);

  // Anti-abuso: tope de bursts por minuto (un humano no llega; un script sí).
  if (!(await rateLimit(ip, "generate", 20, 60))) {
    return NextResponse.json(
      { error: "Demasiadas generaciones seguidas. Esperá un minuto." },
      { status: 429 }
    );
  }

  // Verificar límite free por IP
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

    let text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return NextResponse.json({ error: "La IA no devolvió respuesta" }, { status: 502 });
    }

    // Garantía dura del límite de título de ML + limpieza de secciones vacías.
    if (slug === "descripciones") {
      text = await enforceMlTitleLimit(text);
      text = cleanMlOutput(text);
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
