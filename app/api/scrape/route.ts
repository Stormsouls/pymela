import { NextRequest, NextResponse } from "next/server";
import { groq, DEFAULT_MODEL } from "@/lib/groq";

export const runtime = "nodejs";

// ─── Helpers ────────────────────────────────────────────────────────────────

// Extrae nombre legible del slug de cualquier URL como último recurso
function slugFromUrl(u: URL): string {
  const segments = u.pathname.split("/").filter(Boolean);
  const slug = segments.sort((a, b) => b.length - a.length)[0] ?? "";
  return slug
    .replace(/\.[a-z]{2,5}$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\d{6,}\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 100);
}

// MercadoLibre: extrae título del slug de la URL (API requiere auth)
function parseMlUrl(url: string): Record<string, string> {
  try {
    const u = new URL(url);
    const segment = u.pathname.split("/").pop() ?? "";
    const titleSlug = segment.replace(/^ML[A-Z]-?\d+-?/i, "").replace(/_[A-Z]+$/, "");
    const producto = titleSlug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    return { producto, categoria: "", condicion: "Nuevo", caracteristicas: "" };
  } catch {
    return { producto: "", categoria: "", condicion: "Nuevo", caracteristicas: "" };
  }
}

// Extrae texto útil de HTML crudo (fallback cuando Jina no está disponible)
function extractTextFromHtml(html: string): string {
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const json = JSON.parse(nextDataMatch[1]);
      return `[JSON]\n${JSON.stringify(json?.props?.pageProps ?? json?.props ?? {}).slice(0, 12000)}`;
    } catch { /* ignorar */ }
  }
  const metaTitle = html.match(/<meta property="og:title"[^>]*content="([^"]+)"/i)?.[1] ?? "";
  const metaDesc  = html.match(/<meta property="og:description"[^>]*content="([^"]+)"/i)?.[1] ?? "";
  const meta = [metaTitle && `Título: ${metaTitle}`, metaDesc && `Descripción: ${metaDesc}`].filter(Boolean).join("\n");
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return `${meta ? "[META]\n" + meta + "\n\n" : ""}[TEXTO]\n${text.slice(0, 10000)}`;
}

// ─── Jina Reader ─────────────────────────────────────────────────────────────
// Convierte cualquier URL en texto limpio, incluyendo páginas SPA/JS-heavy.
// Documentación: https://jina.ai/reader/
async function fetchViaJina(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: "application/json",
        "X-Return-Format": "text",
        "X-Timeout": "10",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code !== 200 || !json.data) return null;
    const { title = "", description = "", content = "" } = json.data;
    // Combinar título + descripción + contenido (limitar a 12K chars)
    return `Título: ${title}\nDescripción: ${description}\n\n${content}`.slice(0, 12000);
  } catch {
    return null;
  }
}

// ─── Extracción con Groq ─────────────────────────────────────────────────────
async function extractWithGroq(pageContent: string): Promise<Record<string, string> | null> {
  const completion = await groq.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.1,
    max_tokens: 800,
    messages: [
      {
        role: "system",
        content:
          "Sos un extractor de datos de productos. Tu única tarea es leer contenido de una página de producto y devolver un JSON. No inventes datos. Si un campo no está disponible, devolvé cadena vacía.",
      },
      {
        role: "user",
        content: `Extraé los datos y devolvé SOLO un JSON válido con esta estructura (sin texto extra, sin markdown):
{"producto":"nombre completo","categoria":"categoría","condicion":"Nuevo|Usado|Reacondicionado","caracteristicas":"características separadas por comas o saltos de línea"}

Contenido:
${pageContent}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  try {
    const direct = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try { return JSON.parse(direct); } catch { /* seguir */ }
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch { /* ignorar */ }
  return null;
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: { url?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) return NextResponse.json({ error: "Falta la URL" }, { status: 400 });

  let parsed: URL;
  try { parsed = new URL(url); } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Solo se permiten URLs http/https" }, { status: 400 });
  }

  // MercadoLibre: extraer del slug (API requiere auth)
  if (url.includes("mercadolibre")) {
    return NextResponse.json({
      fields: parseMlUrl(url),
      hint: "Completamos el título desde el link. Revisá y agregá las características.",
    });
  }

  // ── Paso 1: obtener contenido vía Jina Reader (maneja SPAs y JS-heavy)
  let pageContent = await fetchViaJina(url);

  // ── Paso 2: si Jina falla, intentar fetch directo + extracción de HTML
  if (!pageContent) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html",
          "Accept-Language": "es-419,es;q=0.9",
          "Accept-Encoding": "identity",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const html = await res.text();
        pageContent = extractTextFromHtml(html);
      }
    } catch { /* ignorar */ }
  }

  // ── Paso 3: si no hay contenido útil, caer al slug de la URL
  if (!pageContent || pageContent.replace(/\s/g, "").length < 200) {
    const nombre = slugFromUrl(parsed);
    return NextResponse.json({
      fields: { producto: nombre, categoria: "", condicion: "Nuevo", caracteristicas: "" },
      hint: nombre
        ? "Solo pudimos leer el nombre del link. Completá el resto de los campos."
        : "No pudimos acceder a esta página. Completá los campos manualmente.",
    });
  }

  // ── Paso 4: Groq extrae los campos estructurados
  const data = await extractWithGroq(pageContent);

  if (!data) {
    const nombre = slugFromUrl(parsed);
    return NextResponse.json({
      fields: { producto: nombre, categoria: "", condicion: "Nuevo", caracteristicas: "" },
      hint: "Solo pudimos leer el nombre del link. Completá el resto de los campos.",
    });
  }

  // Normalizar condición
  const c = (data.condicion ?? "").toLowerCase();
  data.condicion = c.includes("usado") || c.includes("used") ? "Usado"
    : c.includes("reacond") || c.includes("refurb") ? "Reacondicionado"
    : "Nuevo";

  return NextResponse.json({ fields: data });
}
