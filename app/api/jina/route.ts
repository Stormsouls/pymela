// Edge runtime: hasta 30s de timeout (vs 10s de serverless en Vercel Hobby).
// Proxy a Jina Reader: evita CORS del browser y el límite de serverless.
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "edge";

// MercadoLibre (mlstatic) sirve la misma foto en muchos tamaños. Llevamos cada
// imagen a su versión más grande (2X + sufijo -O) para que sirvan de portada.
function upscaleMlImage(url: string): string {
  if (!/mlstatic\.com/i.test(url)) return url;
  let u = url;
  u = u.replace(/D_NQ_NP_(?!2X_)/, "D_NQ_NP_2X_");
  u = u.replace(/-[A-Z](\.(?:jpg|jpeg|png|webp|avif))(\?|$)/i, "-O$1$2");
  return u;
}

// ID estable de una foto de ML (para deduplicar el mismo producto en distintos tamaños).
function dedupeKey(url: string): string {
  const ml = url.match(/([0-9]{5,}-ML[A-Z][0-9]+)/);
  if (ml) return "ml:" + ml[1];
  return url.split("?")[0].toLowerCase();
}

// Extrae URLs de imágenes del contenido markdown de Jina.
// Prioriza fotos del producto (mismo CDN/producto), las normaliza a alta resolución
// y deduplica para maximizar la RELEVANCIA por sobre la cantidad.
function extractImages(content: string, imagesData: Record<string, unknown> | null): string[] {
  const seenKey = new Set<string>();
  const primary: string[] = []; // fotos del producto (mlstatic / CDN de la propia publicación)
  const secondary: string[] = []; // otras imágenes plausibles de producto

  const consider = (raw: string) => {
    if (!isProductImage(raw)) return;
    const url = upscaleMlImage(raw);
    const key = dedupeKey(url);
    if (seenKey.has(key)) return;
    seenKey.add(key);
    if (/mlstatic\.com|alicdn|imgextra|\/(product|item|goods)\//i.test(raw)) primary.push(url);
    else secondary.push(url);
  };

  // 1. imagesData (X-With-Images-Summary) — la fuente más confiable
  if (imagesData && typeof imagesData === "object") {
    for (const url of Object.keys(imagesData)) consider(url);
  }
  // 2. markdown ![alt](url)
  for (const m of content.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) consider(m[1]);
  // 3. URLs de imagen sueltas
  for (const m of content.matchAll(/https?:\/\/[^\s"'<>)]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^\s"'<>)]*)?/gi)) consider(m[0]);

  // Primero las del producto; completamos con secundarias solo si hacen falta. Máx 30.
  return [...primary, ...secondary].slice(0, 30);
}

// Extrae videos PROPIOS de la publicación (descargables): mp4/webm directos y
// clips de MercadoLibre. No incluye YouTube ni terceros (no son descargables ni propios).
function extractVideos(content: string): string[] {
  const seen = new Set<string>();
  const vids: string[] = [];
  const add = (u: string) => { if (!seen.has(u)) { seen.add(u); vids.push(u); } };
  for (const m of content.matchAll(/https?:\/\/[^\s"'<>)]+\.(?:mp4|webm|mov)(?:\?[^\s"'<>)]*)?/gi)) add(m[0]);
  for (const m of content.matchAll(/https?:\/\/[^\s"'<>)]*clips\.mlstatic\.com[^\s"'<>)]+/gi)) add(m[0]);
  return vids.slice(0, 3);
}

function isProductImage(url: string): boolean {
  const lower = url.toLowerCase();
  // Descartar logos, iconos, tracking pixels, SVGs
  const skip = ["favicon", "sprite", "pixel", "tracking", "badge", ".svg",
    "1x1", "placeholder", "blank", "_ttd_", "logo._", "error/"];
  if (skip.some((s) => lower.includes(s))) return false;
  // Aceptar si tiene extensión de imagen conocida o URL de CDN de imagen
  const hasImgExt = /\.(jpg|jpeg|png|webp|avif|bmp)(\?|_|$)/i.test(lower);
  const isImgCdn = /\/(img|image|images|photo|photos|media|product|item|goods)\//i.test(lower);
  const isImgHost = lower.includes("cdn") || lower.includes("imgextra") || lower.includes("alicdn") || lower.includes("mlstatic");
  return hasImgExt || isImgCdn || isImgHost;
}

export async function GET(req: Request) {
  if (!(await rateLimit(getClientIp(req), "jina", 15, 60))) {
    return Response.json({ error: "Demasiadas solicitudes. Esperá un minuto." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return Response.json({ error: "Falta el parámetro url" }, { status: 400 });
  }

  // Solo permitir http/https públicos (evita abusar el proxy con esquemas raros).
  let parsed: URL;
  try { parsed = new URL(url); } catch {
    return Response.json({ error: "URL inválida" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return Response.json({ error: "Protocolo no permitido" }, { status: 400 });
  }

  try {
    // Con API key, Jina habilita rendering de SPAs y más cuota. Sin key, el tier
    // anónimo suele devolver contenido vacío para sitios con JS (degradado).
    const apiKey = process.env.JINA_API_KEY;
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: "application/json",
        "X-Return-Format": "text",
        "X-With-Images-Summary": "true",
        "X-Timeout": "25",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}`, "X-Engine": "browser" } : {}),
      },
      signal: AbortSignal.timeout(28000),
    });

    if (!res.ok) {
      return Response.json({ error: `Jina respondió ${res.status}` }, { status: 502 });
    }

    const data = await res.json();

    // Extraer imágenes y videos del response
    if (data.code === 200 && data.data) {
      const content = data.data.content ?? data.data.text ?? "";
      const imagesData = data.data.images ?? null;
      data.data.extractedImages = extractImages(content, imagesData);
      data.data.extractedVideos = extractVideos(content);
    }

    return Response.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return Response.json({ error: msg }, { status: 502 });
  }
}
