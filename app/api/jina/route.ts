// Edge runtime: hasta 30s de timeout (vs 10s de serverless en Vercel Hobby).
// Proxy a Jina Reader: evita CORS del browser y el límite de serverless.
export const runtime = "edge";

// Extrae URLs de imágenes del contenido markdown de Jina.
// Filtra logos/iconos comunes y prioriza las más grandes/relevantes.
function extractImages(content: string, imagesData: Record<string, unknown> | null): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  // 1. Si Jina devolvió imagesData (con X-With-Images-Summary)
  if (imagesData && typeof imagesData === "object") {
    for (const url of Object.keys(imagesData)) {
      if (isProductImage(url) && !seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }
  }

  // 2. Buscar en el markdown: ![alt](url)
  const mdImages = [...content.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)];
  for (const m of mdImages) {
    const url = m[1];
    if (isProductImage(url) && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  // 3. Buscar URLs de imagen sueltas en el texto
  const rawUrls = [...content.matchAll(/https?:\/\/[^\s"'<>)]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^\s"'<>)]*)?/gi)];
  for (const m of rawUrls) {
    const url = m[0];
    if (isProductImage(url) && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls.slice(0, 20); // máximo 20 imágenes
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
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return Response.json({ error: "Falta el parámetro url" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: "application/json",
        "X-Return-Format": "text",
        "X-With-Images-Summary": "true",
        "X-Timeout": "25",
      },
      signal: AbortSignal.timeout(28000),
    });

    if (!res.ok) {
      return Response.json({ error: `Jina respondió ${res.status}` }, { status: 502 });
    }

    const data = await res.json();

    // Extraer imágenes del response
    if (data.code === 200 && data.data) {
      const content = data.data.content ?? data.data.text ?? "";
      const imagesData = data.data.images ?? null;
      data.data.extractedImages = extractImages(content, imagesData);
    }

    return Response.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return Response.json({ error: msg }, { status: 502 });
  }
}
