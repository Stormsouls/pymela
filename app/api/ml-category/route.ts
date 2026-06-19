import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 20;

// Mapea el dominio de MercadoLibre del país al site_id que usa la API.
function siteFromHost(host: string): string {
  const h = (host || "").toLowerCase();
  if (h.includes(".com.mx")) return "MLM";
  if (h.includes(".com.br") || h.includes("mercadolivre")) return "MLB";
  if (h.includes(".com.co")) return "MCO";
  if (h.includes(".cl")) return "MLC";
  if (h.includes(".com.uy")) return "MLU";
  if (h.includes(".com.pe")) return "MPE";
  if (h.includes(".com.ve")) return "MLV";
  if (h.includes(".com.ec")) return "MEC";
  if (h.includes(".com.bo")) return "MBO";
  if (h.includes(".com.py")) return "MPY";
  return "MLA"; // Argentina por defecto
}

// Devuelve el árbol de categorías exacto donde conviene publicar en MercadoLibre.
// Usa el predictor oficial (domain_discovery) + el path_from_root de la categoría.
// Es la API pública de ML (sin auth); si falla, devolvemos path vacío sin romper.
export async function POST(req: NextRequest) {
  let body: { q?: string; site?: string; host?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!(await rateLimit(getClientIp(req), "ml_items", 12, 60))) {
    return NextResponse.json({ error: "Demasiadas solicitudes. Esperá un minuto." }, { status: 429 });
  }

  const q = (body.q ?? "").trim().slice(0, 120);
  if (!q) return NextResponse.json({ error: "Falta el producto" }, { status: 400 });
  const site = body.site?.trim() || siteFromHost(body.host ?? "");

  try {
    const dd = await fetch(
      `https://api.mercadolibre.com/sites/${site}/domain_discovery/search?limit=1&q=${encodeURIComponent(q)}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
    );
    if (!dd.ok) return NextResponse.json({ path: [] });
    const preds = await dd.json();
    const top = Array.isArray(preds) && preds.length ? preds[0] : null;
    const categoryId: string | undefined = top?.category_id;
    if (!categoryId) return NextResponse.json({ path: [] });

    const catRes = await fetch(`https://api.mercadolibre.com/categories/${categoryId}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!catRes.ok) {
      return NextResponse.json({ path: [], categoryId, categoryName: top?.category_name ?? "" });
    }
    const cat = await catRes.json();
    const path: string[] = Array.isArray(cat?.path_from_root)
      ? cat.path_from_root.map((c: { name: string }) => c.name).filter(Boolean)
      : [];

    return NextResponse.json({
      path,
      categoryId,
      categoryName: cat?.name ?? top?.category_name ?? "",
      domain: top?.domain_name ?? "",
    });
  } catch {
    return NextResponse.json({ path: [] });
  }
}
