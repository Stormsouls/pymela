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
    mine?: { producto?: string; keyword?: string; caracteristicas?: string; marca?: string };
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
  const mine = body.mine ?? {};

  // Tokens del producto del vendedor para detectar coincidencias EXACTAS (misma marca/modelo)
  // y para poder ampliar la búsqueda si el modelo exacto no figura en el catálogo.
  const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const mineText = norm(`${mine.marca ?? ""} ${mine.producto ?? ""} ${mine.keyword ?? ""}`);
  const mineBrand = norm(mine.marca ?? "").split(/\s+/).filter((w) => w.length > 2)[0] ?? "";
  const mineModels = Array.from(
    new Set(mineText.match(/\b[a-z]{1,4}\d{1,4}[a-z]?\b|\b\d{2,4}[a-z]{1,3}\b/g) ?? [])
  ).filter((m) => m.length >= 2);

  // Query genérica: saca marca, código de modelo y palabras vacías del término de
  // búsqueda. Muchísimos productos (marcas chinas, modelos nuevos) NO están en el
  // catálogo curado de ML con su modelo exacto, pero la CATEGORÍA sí tiene productos
  // para comparar (ej: "anillo yawell r09" → "anillo inteligente"). Sin esto, el
  // catálogo devuelve 0 y mostrábamos "no hay competencia" cuando sí la hay.
  const stop = new Set(["de", "para", "con", "el", "la", "los", "las", "un", "una", "y", "o", "del", "al"]);
  const brandToks = new Set(norm(mine.marca ?? "").split(/\s+/).filter(Boolean));
  const modelToks = new Set(mineModels);
  const generic = Array.from(
    new Set(
      norm(`${mine.keyword || ""} ${mine.producto || ""}`)
        .split(/\s+/)
        .filter((w) => w && !stop.has(w) && !brandToks.has(w) && !modelToks.has(w) && !/\d/.test(w))
    )
  )
    .slice(0, 5)
    .join(" ")
    .trim();

  // Buscar productos del mismo tipo en el catálogo de ML.
  let products: CatalogProduct[] = [];
  try {
    products = await searchCatalogProducts(site, q, token, 15);
    // Pocos (o ningún) resultado con el modelo exacto → ampliar al término genérico de
    // la categoría para igual mostrar el mercado. Se mergea sin duplicar (exactos primero).
    if (products.length < 5 && generic && norm(generic) !== norm(q)) {
      try {
        const more = await searchCatalogProducts(site, generic, token, 15);
        const seen = new Set(products.map((p) => p.id));
        for (const p of more) if (!seen.has(p.id)) { seen.add(p.id); products.push(p); }
      } catch { /* la búsqueda amplia es best-effort */ }
    }
  } catch {
    // ML bloqueó el acceso para esta cuenta o site.
    return NextResponse.json({ connected: true, available: false });
  }

  if (products.length === 0) {
    return NextResponse.json({ connected: true, available: true, empty: true, analisis: null });
  }

  // Normalizar + clasificar cada producto del catálogo (exacto vs parecido).
  const comps = products.slice(0, 14).map((p) => {
    const attrs = (p.attributes ?? []).filter((a) => a.value_name);
    const get = (id: string) => attrs.find((a) => a.id === id)?.value_name ?? "";
    const marca = get("BRAND");
    const modelo = get("MODEL") || get("ALPHANUMERIC_MODEL") || get("LINE");
    const hay = norm(`${p.name ?? ""} ${marca} ${modelo}`);
    const brandMatch = !!mineBrand && (norm(marca).includes(mineBrand) || hay.includes(mineBrand));
    const modelMatch = mineModels.some((m) => hay.includes(m));
    const exact = brandMatch && modelMatch;
    return {
      name: p.name ?? "",
      marca,
      modelo,
      attrs: attrs.map((a) => `${a.name}: ${a.value_name}`).slice(0, 14),
      tier: exact ? 2 : modelMatch || brandMatch ? 1 : 0,
      exact,
    };
  });

  // Ordenar: primero los exactos, luego los parecidos.
  comps.sort((a, b) => b.tier - a.tier);
  const exactCount = comps.filter((c) => c.exact).length;

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

  // Contexto para Groq: separar EXACTOS de PARECIDOS para darles distinto peso.
  const fmtList = (list: typeof comps) =>
    list
      .map(
        (c, i) =>
          `#${i + 1} ${c.name}${c.marca ? ` | Marca: ${c.marca}` : ""}${c.modelo ? ` | Modelo: ${c.modelo}` : ""}\nAtributos: ${c.attrs.join("; ") || "—"}`
      )
      .join("\n\n");
  const exactList = comps.filter((c) => c.exact);
  const similarList = comps.filter((c) => !c.exact);
  const compContext =
    (exactList.length
      ? `=== EXACTAMENTE TU PRODUCTO (mismo modelo/marca — MÁXIMA prioridad) ===\n${fmtList(exactList)}\n\n`
      : "") +
    (similarList.length
      ? `=== PRODUCTOS PARECIDOS (referencia secundaria, menor peso) ===\n${fmtList(similarList)}`
      : "");

  const voice =
    [
      mine.producto && `Producto: ${mine.producto}`,
      mine.marca && `Marca y modelo: ${mine.marca}`,
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
            content: `Comparé el producto del vendedor con lo que ya se vende en MercadoLibre. Armá un análisis simple y accionable.

EL PRODUCTO DEL VENDEDOR:
${voice}

LO QUE SE VENDE EN EL MERCADO:
${compContext}

REGLA DE PESO: dale MUCHA más importancia a los productos "EXACTAMENTE TU PRODUCTO" (mismo modelo/marca) — son tu competencia directa, de ahí salen las conclusiones más fuertes. Los "PARECIDOS" son referencia secundaria y algunos pueden no aplicar a este producto; usalos solo como contexto general.

Devolvé SOLO este JSON (frases cortas y claras, sin tecnicismos, en español neutro; 2-4 ítems por lista; lista vacía si no hay datos):
{"resumen":"1-2 frases sobre cómo está el mercado para este producto","competencia":["con qué marcas/modelos vas a competir, priorizando los iguales a tu producto"],"que_ofrecen":["qué características destacan los que ya venden"],"como_destacar":["formas concretas de diferenciarte y llamar la atención"],"que_te_falta":["datos o características que el mercado muestra y conviene que tengas en tu publicación"],"palabras_clave":["palabras que más se repiten en los títulos del mercado"],"consejos":["consejos concretos para vender más"]}`,
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

  return NextResponse.json({ connected: true, available: true, exactCount, marcas, analisis });
}
