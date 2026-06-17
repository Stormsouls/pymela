import { NextRequest, NextResponse } from "next/server";
import { groq, DEFAULT_MODEL } from "@/lib/groq";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getVerifiedMlUid } from "@/lib/ml-session";
import { getConnectionByMlUserId, getFreshToken, getItem } from "@/lib/ml-api";

export const runtime = "nodejs";
export const maxDuration = 60;

// Bloquea hosts que apunten a la red interna (evita SSRF al fetchear URLs del usuario).
function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h === "169.254.169.254" ||      // metadata de cloud (AWS/GCP/Azure)
    h.startsWith("127.") ||
    h.startsWith("10.") ||
    h.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||  // 172.16.0.0 – 172.31.255.255
    h.startsWith("169.254.") ||
    h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")  // IPv6 privado/link-local
  );
}

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
  let raw = "";
  try {
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
    }, { timeout: 25000 });
    raw = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch {
    // Groq caído / rate-limit de hora pico / timeout → devolvemos null y el handler
    // cae al fallback (nombre del slug). NUNCA propagar: un throw acá hace que la
    // función serverless muera con body vacío → el cliente ve "no respondió a tiempo".
    return null;
  }

  try {
    const direct = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try { return JSON.parse(direct); } catch { /* seguir */ }
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch { /* ignorar */ }
  return null;
}

// ─── MercadoLibre ────────────────────────────────────────────────────────────
// ML bloquea el scraping anónimo. Con la cuenta conectada (OAuth) usamos la API
// oficial: trae título, atributos, condición, garantía y fotos HD reales.
async function handleMercadoLibre(req: NextRequest, url: string, parsed: URL): Promise<NextResponse> {
  const slugFields = parseMlUrl(url);

  // Extraer el item id del path: .../MLA-1904213156-... → MLA1904213156
  const m = parsed.pathname.match(/(ML[A-Z])-?(\d+)/i);
  const itemId = m ? `${m[1].toUpperCase()}${m[2]}` : "";

  const uid = getVerifiedMlUid(req);
  if (uid && itemId) {
    try {
      const conn = await getConnectionByMlUserId(uid);
      if (conn) {
        const token = await getFreshToken(conn);
        const item = await getItem(itemId, token);
        const attrs = (item.attributes ?? [])
          .filter((a) => a.value_name)
          .map((a) => `${a.name}: ${a.value_name}`)
          .join("\n");
        const condicion = item.condition === "used" ? "Usado"
          : item.condition === "refurbished" ? "Reacondicionado" : "Nuevo";
        const images = (item.pictures ?? []).map((p) => p.secure_url || p.url).filter(Boolean);
        return NextResponse.json({
          fields: {
            producto: item.title || slugFields.producto,
            categoria: "",
            condicion,
            caracteristicas: attrs,
            marca: (item.attributes ?? []).find((a) => /marca/i.test(a.name))?.value_name ?? "",
            garantia: item.warranty ?? "",
          },
          images,
          hint: images.length ? "Datos y fotos traídos desde tu cuenta de ML. Revisalos antes de generar." : "Trajimos los datos desde tu cuenta de ML. Revisá las características.",
        });
      }
    } catch { /* caer al fallback */ }
  }

  // Sin cuenta conectada: ML no deja extraer fotos. Guiamos al usuario.
  return NextResponse.json({
    fields: slugFields,
    images: [],
    hint: "MercadoLibre no permite traer las fotos de una publicación automáticamente. Para conseguirlas, pegá el link del proveedor o fabricante del producto (AliExpress, una tienda online, etc.) o conectá tu cuenta de ML.",
  });
}

// ─── Handler ─────────────────────────────────────────────────────────────────
// Acepta dos modos:
//   { url }             → modo legacy: fetch en el servidor (solo para sites sin JS)
//   { url, content }    → modo rápido: el browser ya trajo el contenido vía Jina,
//                         el servidor solo llama a Groq (<3s, entra en el límite de 10s)
export async function POST(req: NextRequest) {
  let body: { url?: string; content?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!(await rateLimit(getClientIp(req), "scrape", 15, 60))) {
    return NextResponse.json({ error: "Demasiadas solicitudes. Esperá un minuto." }, { status: 429 });
  }

  const url = (body.url ?? "").trim();
  const content = (body.content ?? "").trim();

  if (!url) return NextResponse.json({ error: "Falta la URL" }, { status: 400 });

  let parsed: URL;
  try { parsed = new URL(url); } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol) || isPrivateHost(parsed.hostname)) {
    return NextResponse.json({ error: "URL no permitida" }, { status: 400 });
  }

  // MercadoLibre: bloquea el scraping anónimo (anti-bot). Si el usuario conectó
  // su cuenta de ML, usamos la API oficial para traer datos + fotos HD reales.
  if (url.includes("mercadolibre") || url.includes("mercadolivre")) {
    return await handleMercadoLibre(req, url, parsed);
  }

  // ── Modo rápido: content ya viene del browser (Jina corrió en el cliente)
  let pageContent = content || null;

  // ── Modo server: fetch directo para sites con HTML estático (fallback)
  if (!pageContent) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html",
          "Accept-Language": "es-419,es;q=0.9",
          "Accept-Encoding": "identity",
        },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const html = await res.text();
        pageContent = extractTextFromHtml(html);
      }
    } catch { /* ignorar */ }
  }

  // ── Sin contenido útil → slug de URL
  if (!pageContent || pageContent.replace(/\s/g, "").length < 200) {
    const nombre = slugFromUrl(parsed);
    return NextResponse.json({
      fields: { producto: nombre, categoria: "", condicion: "Nuevo", caracteristicas: "" },
      hint: nombre
        ? "Solo pudimos leer el nombre del link. Completá el resto de los campos."
        : "No pudimos acceder a esta página. Completá los campos manualmente.",
    });
  }

  // ── Groq extrae los campos estructurados
  const data = await extractWithGroq(pageContent);

  if (!data) {
    const nombre = slugFromUrl(parsed);
    return NextResponse.json({
      fields: { producto: nombre, categoria: "", condicion: "Nuevo", caracteristicas: "" },
      hint: "Solo pudimos leer el nombre del link. Completá el resto de los campos.",
    });
  }

  const c = (data.condicion ?? "").toLowerCase();
  data.condicion = c.includes("usado") || c.includes("used") ? "Usado"
    : c.includes("reacond") || c.includes("refurb") ? "Reacondicionado"
    : "Nuevo";

  return NextResponse.json({ fields: data });
}
