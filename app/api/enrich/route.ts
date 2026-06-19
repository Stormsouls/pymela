import { NextRequest, NextResponse } from "next/server";
import { groq, DEFAULT_MODEL } from "@/lib/groq";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// BOM y zero-width chars se cuelan al cargar env vars vía pipe — los stripeamos.
function getJinaKey(): string | undefined {
  return process.env.JINA_API_KEY?.replace(/[﻿​-‍]/g, "").trim() || undefined;
}

// Lee una URL con Jina Reader y devuelve su contenido.
// format "markdown" conserva los links (útil para leer una página de resultados).
async function jinaRead(url: string, timeoutSec: number, format: "text" | "markdown" = "text"): Promise<{ title: string; content: string } | null> {
  try {
    const apiKey = getJinaKey();
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

  // ── Buscar specs con Jina Search (s.jina.ai — requiere JINA_API_KEY) ──────────
  const query = `${marca} ${producto} especificaciones ficha técnica`.trim();
  const apiKey = getJinaKey();
  const fuentes: string[] = [];
  let searchSnippets = "";

  if (apiKey) {
    try {
      const sr = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          "X-Timeout": "25",
        },
        signal: AbortSignal.timeout(28000),
      });
      if (sr.ok) {
        const data = await sr.json();
        if (Array.isArray(data?.data)) {
          for (const r of data.data.slice(0, 5)) {
            if (r.url && !fuentes.includes(r.url)) fuentes.push(r.url);
            if (r.content && r.content.length > 200) {
              searchSnippets += `FUENTE ${r.url}:\n${r.content.slice(0, 3000)}\n\n---\n\n`;
            }
            if (fuentes.length >= 3 && searchSnippets.length > 5000) break;
          }
        }
      }
    } catch { /* sin resultados */ }
  }

  // Fallback: leer la primera fuente si Jina Search no trajo contenido.
  if (!searchSnippets && fuentes.length) {
    const page = await jinaRead(fuentes[0], 20, "markdown");
    if (page?.content) searchSnippets = `FUENTE ${fuentes[0]}:\n${page.content.slice(0, 6000)}`;
  }

  const corpus = searchSnippets.slice(0, 9000);

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
            `Atributos que YA tengo (NO los repitas — son los que ya saqué de la publicación):\n${existing || "(ninguno)"}\n\n` +
            `Contenido de fuentes web:\n${corpus}\n\n` +
            `Tu objetivo es COMPLETAR LOS HUECOS: encontrá los atributos que FALTAN en la lista de arriba.\n` +
            `Priorizá los que más pesan en una ficha de MercadoLibre y que no tenga todavía, por ejemplo: ` +
            `marca, modelo, color, material, medidas/dimensiones, peso, capacidad, compatibilidad, conectividad, ` +
            `autonomía/batería, resistencia al agua, contenido de la caja, garantía.\n` +
            `Devolvé un JSON con esta forma exacta:\n` +
            `{"atributos":[{"name":"Nombre del atributo","value":"valor textual de la fuente"}]}\n` +
            `Reglas: solo atributos NUEVOS (que no estén en los que ya tengo), solo si están EXPLÍCITOS en el contenido ` +
            `(nunca inventes ni infieras), en español. Si no hay ninguno confiable, devolvé {"atributos":[]}.`,
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
