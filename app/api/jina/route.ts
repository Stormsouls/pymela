// Edge runtime: hasta 30s de timeout (vs 10s de serverless en Vercel Hobby).
// Actúa como proxy a Jina Reader para evitar el límite de serverless
// y los problemas de CORS desde el browser.
export const runtime = "edge";

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
        "X-Timeout": "25",
      },
      signal: AbortSignal.timeout(28000),
    });

    if (!res.ok) {
      return Response.json({ error: `Jina respondió ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return Response.json({ error: msg }, { status: 502 });
  }
}
