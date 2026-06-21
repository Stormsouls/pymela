import { NextRequest, NextResponse } from "next/server";
import { groq, DEFAULT_MODEL } from "@/lib/groq";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getVerifiedMlUid } from "@/lib/ml-session";
import {
  getConnectionByMlUserId,
  getFreshToken,
  siteFromHost,
  searchCatalogProducts,
  type CatalogProduct,
} from "@/lib/ml-api";

export const runtime = "nodejs";
export const maxDuration = 45;

// Analiza la competencia de un producto en MercadoLibre usando el catálogo oficial.
// Requiere cuenta de ML conectada (la API de catálogo exige token; anónimo da 403).
// Nota: ML NO expone por API precios/ofertas ni reseñas a esta app (PolicyAgent),
// así que el análisis se basa en marcas, modelos y atributos del mercado.
export async function POST(req: NextRequest) {
  let body: {
    q?: string;
    host?: string;
    mine?: { producto?: string; keyword?: string; caracteristicas?: string };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!(await rateLimit(getClientIp(req), "ml_items", 12, 60))) {
    return NextResponse.json({ error: "Demasiadas solicitudes. Esperá un minuto." }, { status: 429 });
  }

  const q = (body.q ?? "").trim().slice(0, 120);
  if (!q) return NextResponse.json({ error: "Falta el producto" }, { status: 400 });

  const uid = getVerifiedMlUid(req);
  if (!uid) return NextResponse.json({ connected: false });

  const conn = await getConnectionByMlUserId(uid);
  if (!conn) return NextResponse.json({ connected: false });

  let token: string;
  try {
    token = await getFreshToken(conn);
  } catch {
    // Token vencido y sin refresh válido → la cuenta hay que reconectarla.
    return NextResponse.json({ connected: false, expired: true });
  }

  const site = siteFromHost(body.host ?? "");

  // Buscar productos del mismo tipo en el catálogo de ML.
  let products: CatalogProduct[] = [];
  try {
    products = await searchCatalogProducts(site, q, token, 15);
  } catch {
    // ML bloqueó el acceso para esta cuenta o site.
    return NextResponse.json({ connected: true, available: false });
  }

  if (products.length === 0) {
    return NextResponse.json({ connected: true, available: true, empty: true, analisis: null });
  }

  // Normalizar: nombre + marca/modelo + atributos por producto.
  const comps = products.slice(0, 12).map((p) => {
    const attrs = (p.attributes ?? []).filter((a) => a.value_name);
    const get = (id: string) => attrs.find((a) => a.id === id)?.value_name ?? "";
    return {
      name: p.name ?? "",
      marca: get("BRAND"),
      modelo: get("MODEL") || get("ALPHANUMERIC_MODEL") || get("LINE"),
      attrs: attrs.map((a) => `${a.name}: ${a.value_name}`).slice(0, 14),
    };
  });

  // Marcas más frecuentes (determinístico, sin gastar tokens).
  const brandCount: Record<string, number> = {};
  for (const c of comps) {
    const b = c.marca.trim();
    if (b) brandCount[b] = (brandCount[b] ?? 0) + 1;
  }
  const marcas = Object.entries(brandCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  // Contexto para Groq.
  const compContext = comps
    .map(
      (c, i) =>
        `#${i + 1} ${c.name}${c.marca ? ` | Marca: ${c.marca}` : ""}${c.modelo ? ` | Modelo: ${c.modelo}` : ""}\nAtributos: ${c.attrs.join("; ") || "—"}`
    )
    .join("\n\n");

  const mine = body.mine ?? {};
  const voice =
    [
      mine.producto && `Producto: ${mine.producto}`,
      mine.keyword && `Palabra clave: ${mine.keyword}`,
      mine.caracteristicas && `Características propias: ${mine.caracteristicas}`,
    ]
      .filter(Boolean)
      .join("\n") || "(el usuario no detalló su producto)";

  let analisis = null;
  try {
    const completion = await groq.chat.completions.create(
      {
        model: DEFAULT_MODEL,
        temperature: 0.5,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content:
              "Sos un asesor de ventas para vendedores de MercadoLibre. Hablás claro y sin tecnicismos, como a un emprendedor que recién arranca. Devolvés SOLO un JSON válido, sin markdown ni texto extra. Basate ÚNICAMENTE en los datos provistos; no inventes.",
          },
          {
            role: "user",
            content: `Comparé el producto del vendedor con productos parecidos que ya se venden en MercadoLibre. Armá un análisis simple y accionable.

EL PRODUCTO DEL VENDEDOR:
${voice}

PRODUCTOS PARECIDOS EN EL MERCADO (${comps.length}):
${compContext}

Devolvé SOLO este JSON (frases cortas y claras, sin tecnicismos, en español neutro; 2-4 ítems por lista; lista vacía si no hay datos):
{"resumen":"1-2 frases sobre cómo está el mercado para este producto","competencia":["con qué marcas/modelos vas a competir"],"que_ofrecen":["qué características destacan los que ya venden"],"como_destacar":["formas concretas de diferenciarte y llamar la atención"],"que_te_falta":["datos o características que el mercado muestra y conviene que tengas en tu publicación"],"palabras_clave":["palabras que más se repiten en los títulos del mercado"],"consejos":["consejos concretos para vender más"]}`,
          },
        ],
      },
      { timeout: 25000 }
    );
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
      analisis = JSON.parse(cleaned);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) analisis = JSON.parse(m[0]);
    }
  } catch {
    /* Groq caído → devolvemos al menos las marcas del mercado */
  }

  return NextResponse.json({ connected: true, available: true, marcas, analisis });
}
