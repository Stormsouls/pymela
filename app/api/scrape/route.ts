import { NextRequest, NextResponse } from "next/server";
import { groq, DEFAULT_MODEL } from "@/lib/groq";

export const runtime = "nodejs";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
  "Accept-Encoding": "identity", // evitar gzip para simplificar el parse
  "Cache-Control": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

function extractText(html: string): string {
  // 1. Intentar JSON de MercadoLibre (__NEXT_DATA__ o window.__PRELOADED_STATE__)
  // Estos contienen datos estructurados del producto
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const json = JSON.parse(nextDataMatch[1]);
      // Extraer solo las props del producto para no mandar MBs a Groq
      const props = json?.props?.pageProps ?? json?.props ?? {};
      const condensed = JSON.stringify(props).slice(0, 12000);
      return `[DATOS JSON DEL PRODUCTO]\n${condensed}`;
    } catch {
      // ignorar, seguir con HTML
    }
  }

  // 2. Fallback: limpiar el HTML y quedarse con texto relevante
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Extraer meta tags útiles
  const metaTitle = html.match(/<meta property="og:title"[^>]*content="([^"]+)"/i)?.[1] ?? "";
  const metaDesc =
    html.match(/<meta property="og:description"[^>]*content="([^"]+)"/i)?.[1] ?? "";
  const metaType =
    html.match(/<meta property="product:condition"[^>]*content="([^"]+)"/i)?.[1] ?? "";

  const meta = [metaTitle && `Título: ${metaTitle}`, metaDesc && `Descripción: ${metaDesc}`, metaType && `Condición: ${metaType}`]
    .filter(Boolean)
    .join("\n");

  return `${meta ? "[META]\n" + meta + "\n\n" : ""}[TEXTO DE LA PÁGINA]\n${text.slice(0, 10000)}`;
}

// Extrae un nombre de producto legible del slug de cualquier URL
function slugFromUrl(u: URL): string {
  const segments = u.pathname.split("/").filter(Boolean);
  // Tomar el segmento más largo (suele ser el slug del producto)
  const slug = segments.sort((a, b) => b.length - a.length)[0] ?? "";
  return slug
    .replace(/\.[a-z]{2,5}$/i, "") // quitar extensión .html etc
    .replace(/[-_]+/g, " ")
    .replace(/\b\d{6,}\b/g, "") // quitar IDs numéricos largos
    .replace(/\s{2,}/g, " ")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 100);
}

// Detecta si la URL es de MercadoLibre y extrae el item ID
function extractMlItemId(url: string): string | null {
  // Formatos:
  // https://articulo.mercadolibre.com.ar/MLA-123456789-titulo_JM
  // https://www.mercadolibre.com.mx/p/MLM123456789
  const match = url.match(/\/(ML[A-Z]-?\d+)/i);
  if (!match) return null;
  // Normalizar: quitar el guion para la API (MLA-123 → MLA123)
  return match[1].replace("-", "");
}

// Extrae datos de ML desde la URL (sin API — usa el slug del título)
// Ej: /MLA-1234-notebook-lenovo-ryzen-5_JM → "Notebook Lenovo Ryzen 5"
function parseMlUrl(url: string): Record<string, string> {
  try {
    const u = new URL(url);
    // El slug está en el último segmento del path antes de _JM
    const segment = u.pathname.split("/").pop() ?? "";
    // Quitar el prefijo MLA-XXXXXXXX- y el sufijo _JM
    const titleSlug = segment.replace(/^ML[A-Z]-?\d+-?/i, "").replace(/_[A-Z]+$/, "");
    const producto = titleSlug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return { producto, categoria: "", condicion: "Nuevo", caracteristicas: "" };
  } catch {
    return { producto: "", categoria: "", condicion: "Nuevo", caracteristicas: "" };
  }
}

export async function POST(req: NextRequest) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) return NextResponse.json({ error: "Falta la URL" }, { status: 400 });

  // Validación básica de URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Solo se permiten URLs http/https" }, { status: 400 });
  }

  // Camino rápido: si es MercadoLibre, extraer del slug de la URL
  // (la API de ML requiere auth; el slug ya contiene el título)
  const mlId = extractMlItemId(url);
  if (mlId || url.includes("mercadolibre")) {
    const fields = parseMlUrl(url);
    return NextResponse.json({
      fields,
      source: "mercadolibre-url",
      hint: "Completamos el título desde el link. Revisá y agregá las características del producto.",
    });
  }

  // Fetch de la página
  let html: string;
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      // Timeout de 8 segundos
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `La página respondió con error ${res.status}. ¿La URL es pública?` },
        { status: 422 }
      );
    }
    html = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red";
    return NextResponse.json(
      { error: `No se pudo acceder a la URL: ${msg}` },
      { status: 422 }
    );
  }

  // Extraer texto relevante del HTML
  const pageContent = extractText(html);

  // Si el contenido es muy corto (página de CAPTCHA / SPA vacía), saltar Groq
  if (pageContent.replace(/\s/g, "").length < 200) {
    const fallbackName = slugFromUrl(parsed);
    return NextResponse.json({
      fields: { producto: fallbackName, categoria: "", condicion: "Nuevo", caracteristicas: "" },
      hint: fallbackName
        ? "La página carga con JavaScript y no pudimos leer todos los datos. Completamos el nombre desde el link — revisá y completá el resto."
        : "Esta página carga con JavaScript. Completá los campos manualmente.",
    });
  }

  // Pedir a Groq que extraiga los campos del producto
  const completion = await groq.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.1,
    max_tokens: 800,
    messages: [
      {
        role: "system",
        content:
          "Sos un extractor de datos de productos. Tu única tarea es leer el contenido de una página web de producto y devolver un JSON con los campos solicitados. No inventes datos que no estén en la página. Si un campo no está disponible, devolvé una cadena vacía para ese campo.",
      },
      {
        role: "user",
        content: `Extraé los datos de este producto y devolvé SOLAMENTE un JSON válido con esta estructura exacta (sin texto extra, sin markdown):
{
  "producto": "nombre completo del producto",
  "categoria": "categoría del producto",
  "condicion": "Nuevo | Usado | Reacondicionado",
  "caracteristicas": "lista de características clave separadas por comas o saltos de línea"
}

Contenido de la página:
${pageContent}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";

  // Extraer el primer objeto JSON que aparezca en la respuesta
  // (Groq a veces rodea el JSON con texto o markdown)
  let data: Record<string, string>;
  try {
    // Intentar parsear directo primero
    const direct = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
      data = JSON.parse(direct);
    } catch {
      // Buscar el primer { ... } en el texto
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("sin JSON");
      data = JSON.parse(match[0]);
    }
  } catch {
    // Último recurso: extraer del slug de la URL y avisar
    console.error("[scrape] Groq no devolvió JSON válido. raw:", raw.slice(0, 200));
    const fallbackName = slugFromUrl(parsed);
    return NextResponse.json({
      fields: { producto: fallbackName, categoria: "", condicion: "Nuevo", caracteristicas: "" },
      hint: fallbackName
        ? "Solo pudimos leer el nombre del link. Revisá y completá el resto de los campos."
        : "No pudimos extraer los datos. La página puede requerir login o carga con JavaScript. Completá los campos manualmente.",
    });
  }

  // Normalizar condición a los valores del select
  if (data.condicion) {
    const c = data.condicion.toLowerCase();
    if (c.includes("nuevo") || c.includes("new")) data.condicion = "Nuevo";
    else if (c.includes("usado") || c.includes("used")) data.condicion = "Usado";
    else if (c.includes("reacond") || c.includes("refurb")) data.condicion = "Reacondicionado";
    else data.condicion = "Nuevo";
  }

  return NextResponse.json({ fields: data });
}
