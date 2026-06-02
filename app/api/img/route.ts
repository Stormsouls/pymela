// Proxy de descarga de imágenes — necesario porque los browsers bloquean
// la descarga directa de imágenes cross-origin con el atributo download.
export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const filename = searchParams.get("filename") ?? "imagen.jpg";

  if (!url) {
    return new Response("Falta url", { status: 400 });
  }

  // Solo permitir URLs de imágenes (evitar SSRF a IPs internas)
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response("URL inválida", { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return new Response("Protocolo no permitido", { status: 400 });
  }

  // Bloquear IPs privadas
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.startsWith("127.") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host === "::1"
  ) {
    return new Response("IP privada no permitida", { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "image/*,*/*",
        Referer: parsed.origin,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return new Response(`Error ${res.status}`, { status: 502 });
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = await res.arrayBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return new Response(msg, { status: 502 });
  }
}
