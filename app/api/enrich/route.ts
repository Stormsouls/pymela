import { NextRequest, NextResponse } from "next/server";
import { groq, DEFAULT_MODEL } from "@/lib/groq";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

// Lee una URL con Jina Reader (gratis, sin API key) y devuelve su contenido.
// format "markdown" conserva los links (útil para leer una página de resultados).
async function jinaRead(url: string, timeoutSec: number, format: "text" | "markdown" = "text"): Promise<{ title: string; content: string } | null> {
  try {
    const apiKey = process.env.JINA_API_KEY;
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: "application/json",
        "X-Return-Format": format,
        "X-Timeout": String(timeoutSec),
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(timeoutSec * 1000 + 3000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (j.code !== 200 || !j.data) return null;
    return { title: j.data.title ?? "", content: j.data.content ?? j.data.text ?? "" };
  } catch { return null; }
}

// Busca specs reales del producto en la web (DuckDuckGo HTML leído con Jina Reader)
// y extrae SOLO atributos que aparezcan textualmente en las fuentes. No inventa:
// si no encuentra, devuelve vacío. Devuelve atributos + fuentes para que el vendedor verifique.
export async function POST(req: NextRequest) {
  let body: { producto?: string; marca?: string; existing?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!(await rateLimit(getClientIp(req), "enrich", 8, 60))) {
    return NextResponse.json({ error: "Demasiadas búsquedas. Esperá un minuto." }, { status: 429 });
  }

  const producto = (body.producto ?? "").trim();
  const marca = (body.marca ?? "").trim();
  const existing = (body.existing ?? "").trim().slice(0, 2000);
  if (!producto) return NextResponse.json({ error: "Falta el producto" }, { status: 400 });

  // ── Buscar en la web con Jina Reader (gratis) sobre DuckDuckGo HTML ──────────
  const query = `${marca} ${producto} especificaciones ficha técnica`.trim();
  const ddg = await jinaRead(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, 12, "markdown");

  const fuentes: string[] = [];
  if (ddg?.content) {
    const seenHost = new Set<string>();
    for (const m of ddg.content.matchAll(/https?:\/\/[^\s"')\]]+/g)) {
      // DuckDuckGo envuelve los links en /l/?uddg=<url-encodeada>
      const uddg = m[0].match(/[?&]uddg=([^&]+)/);
      const url = uddg ? safeDecode(uddg[1]) : m[0];
      let host: string;
      try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { continue; }
      if (/duckduckgo\.com|jina\.ai|bing\.|google\./i.test(host)) continue;
      if (seenHost.has(host)) continue;
      seenHost.add(host);
      fuentes.push(url);
      if (fuentes.length >= 3) break;
    }
  }

  // Leer la primera fuente confiable para tener contenido rico de specs.
  const pageContent = fuentes.length ? (await jinaRead(fuentes[0], 20, "markdown"))?.content ?? "" : "";
  const corpus = [
    ddg?.content ? `RESULTADOS DE BÚSQUEDA:\n${ddg.content.slice(0, 4000)}` : "",
    pageContent ? `FUENTE ${fuentes[0]}:\n${pageContent.slice(0, 6000)}` : "",
  ].filter(Boolean).join("\n\n---\n\n").slice(0, 9000);

  if (!corpus || corpus.replace(/\s/g, "").length < 150) {
    return NextResponse.json({ atributos: [], fuentes: [], hint: "No encontramos fichas confiables en la web para este producto. Completá los atributos manualmente." });
  }

  // ── Extraer specs reales con Groq (sin inventar) ────────────────────────────
  let atributos: { name: string; value: string }[] = [];
  try {
    const completion = await groq.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: 0.1,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content:
            "Sos un extractor de especificaciones técnicas. Tu única tarea es leer contenido web sobre un producto " +
            "y devolver SOLO las especificaciones que aparezcan EXPLÍCITAS en el texto. " +
            "NUNCA inventes ni infieras valores: si un dato no está textual en las fuentes, NO lo incluyas. " +
            "Devolvés exclusivamente un JSON válido, sin markdown ni comentarios.",
        },
        {
          role: "user",
          content:
            `Producto: ${marca} ${producto}\n\n` +
            `Atributos que YA tengo (no los repitas):\n${existing || "(ninguno)"}\n\n` +
            `Contenido de fuentes web:\n${corpus}\n\n` +
            `Devolvé un JSON con esta forma exacta:\n` +
            `{"atributos":[{"name":"Nombre del atributo","value":"valor textual de la fuente"}]}\n` +
            `Incluí solo atributos NUEVOS (que no estén en los que ya tengo) y que estén EXPLÍCITOS en el contenido. ` +
            `Si no hay ninguno confiable, devolvé {"atributos":[]}.`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(clean.match(/\{[\s\S]*\}/)?.[0] ?? clean);
    if (Array.isArray(parsed?.atributos)) {
      atributos = parsed.atributos
        .filter((a: Record<string, string>) => a?.name && a?.value)
        .map((a: Record<string, string>) => ({ name: String(a.name).slice(0, 60), value: String(a.value).slice(0, 120) }))
        .slice(0, 15);
    }
  } catch { /* devolver vacío */ }

  return NextResponse.json({ atributos, fuentes });
}
