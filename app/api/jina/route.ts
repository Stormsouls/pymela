// Proxy a Jina Reader: evita CORS del browser y centraliza la API key.
// nodejs + maxDuration alto: el render de Jina puede tardar bastante.
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

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

// Dominios de ads/tracking/widgets de terceros — nunca son fotos de producto.
const BLOCKED_HOSTS = [
  "doubleclick.net", "googlesyndication.com", "googletagmanager.com",
  "google-analytics.com", "adservice.google.com", "amazon-adsystem.com",
  "criteo.com", "criteo.net", "taboola.com", "outbrain.com",
  "scorecardresearch.com", "licdn.com", "gravatar.com", "s.w.org",
  "fbcdn.net", "connect.facebook.net",
];

// Palabras que delatan iconos, logos, banderas o badges — nunca son fotos de producto.
const EXCLUDE_KEYWORDS = [
  "favicon", "sprite", "pixel", "tracking", "badge", "1x1", "placeholder",
  "blank", "_ttd_", "logo", "icon", "ico_", "flag", "bandera", "avatar",
  "emoji", "payment", "visa", "mastercard", "paypal", "mercadopago", "amex",
  "diners", "social-", "whatsapp", "facebook", "instagram", "twitter",
  "tiktok", "youtube-icon", "share-", "btn-", "button", "arrow-", "chevron",
  "close-", "menu-", "hamburger", "search-icon", "cart-icon", "user-icon",
  "star-icon", "rating-", "qr-code", "qrcode", "barcode", "captcha",
  "spinner", "loading", "loader", "banner-ad", "advert", "cookie-",
  "gdpr", "ssl-", "trust-badge", "seal-", "stamp-", "watermark",
  "lang-switch", "language-", "selector-",
];

// Extrae URLs de imágenes del contenido markdown de Jina.
// Prioriza fotos del producto (mismo CDN/producto), las normaliza a alta resolución
// y deduplica para maximizar la RELEVANCIA por sobre la cantidad.
function extractImages(content: string, imagesData: Record<string, unknown> | null): string[] {
  const seenKey = new Set<string>();
  const primary: string[] = []; // fotos del producto (mlstatic / CDN de la propia publicación)
  const secondary: string[] = []; // otras imágenes plausibles de producto

  const consider = (raw: string, alt = "") => {
    if (!isProductImage(raw, alt)) return;
    const url = upscaleMlImage(raw);
    const key = dedupeKey(url);
    if (seenKey.has(key)) return;
    seenKey.add(key);
    if (/mlstatic\.com|alicdn|imgextra|\/(product|item|goods)\//i.test(raw)) primary.push(url);
    else secondary.push(url);
  };

  // 1. imagesData (X-With-Images-Summary): { url: altText } — la fuente más confiable
  if (imagesData && typeof imagesData === "object") {
    for (const [url, alt] of Object.entries(imagesData)) consider(url, String(alt ?? ""));
  }
  // 2. markdown ![alt](url) — el alt sirve para filtrar iconos/logos
  for (const m of content.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)) consider(m[2], m[1]);
  // 3. URLs de imagen sueltas
  for (const m of content.matchAll(/https?:\/\/[^\s"'<>)]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^\s"'<>)]*)?/gi)) consider(m[0]);

  // Si hay fotos confiables del propio producto (CDN conocido), priorizamos esas.
  // Si no, las "secondary" son la única señal disponible — se limitan más para no
  // diluir la relevancia con imágenes sueltas de la página (iconos sin filtrar, etc.).
  return primary.length > 0 ? [...primary, ...secondary].slice(0, 30) : secondary.slice(0, 15);
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

function isProductImage(url: string, alt = ""): boolean {
  const lower = url.toLowerCase();
  const altLower = alt.toLowerCase();
  // Match por hostname exacto/subdominio (no substring crudo): evita que "alicdn.com"
  // (CDN legítimo de AliExpress) caiga por contener "licdn.com" (CDN de LinkedIn).
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { /* url relativa */ }
  if (BLOCKED_HOSTS.some((h) => host === h || host.endsWith("." + h))) return false;
  if (EXCLUDE_KEYWORDS.some((k) => lower.includes(k) || altLower.includes(k))) return false;
  if (/\.svg(\?|_|$)/i.test(lower)) return false;
  // Dimensiones explícitas en el nombre de archivo (ej: icon-32x32.png) → es una miniatura.
  const dim = lower.match(/(\d{2,4})x(\d{2,4})(?:\.|_|-|\?|$)/);
  if (dim) {
    const w = parseInt(dim[1], 10), h = parseInt(dim[2], 10);
    if (w < 200 && h < 200) return false;
  }
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
    // X-Return-Format "markdown" es clave: con "text" Jina devuelve contenido vacío
    // para muchos sitios. La API key sube la cuota y mejora el acceso.
    const apiKey = process.env.JINA_API_KEY;
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: "application/json",
        "X-Return-Format": "markdown",
        "X-With-Images-Summary": "true",
        "X-Timeout": "45",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(55000),
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
