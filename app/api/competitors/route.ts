import { NextRequest, NextResponse } from "next/server";
import { groq, DEFAULT_MODEL } from "@/lib/groq";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getVerifiedMlUid } from "@/lib/ml-session";
import {
  getConnectionByMlUserId,
  getFreshToken,
  mlFetch,
  siteFromHost,
  searchItems,
  getItemDescription,
} from "@/lib/ml-api";

export const runtime = "nodejs";
export const maxDuration = 60;

type Comp = {
  id: string;
  title: string;
  price: number;
  currency: string;
  sold: number;
  condition: string;
  permalink: string;
  attrs: string[];
  description: string;
};

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// Analiza la competencia de un producto en MercadoLibre y devuelve un FODA.
// Requiere cuenta de ML conectada: search/descripciones/reseñas exigen token (anónimo = 403).
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

  // Endpoint costoso (varias llamadas a ML + Groq): limitar bursts.
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

  // 1. Buscar publicaciones del mismo producto.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let results: any[] = [];
  try {
    results = await searchItems(site, q, token, 12);
  } catch {
    // ML deprecó/bloqueó el search para esta cuenta o site.
    return NextResponse.json({ connected: true, available: false });
  }

  if (results.length === 0) {
    return NextResponse.json({ connected: true, available: true, empty: true, foda: null });
  }

  const top = results.slice(0, 8);

  // 2. Descripciones de los primeros 5 (best-effort, en paralelo).
  const descById: Record<string, string> = {};
  await Promise.all(
    top.slice(0, 5).map(async (r) => {
      descById[r.id] = await getItemDescription(r.id, token);
    })
  );

  // 3. Reseñas + preguntas de los primeros 3 (best-effort: ML suele restringirlas).
  const reviewsText: string[] = [];
  const questionsText: string[] = [];
  await Promise.all(
    top.slice(0, 3).map(async (r) => {
      try {
        const rv = await mlFetch(`/reviews/item/${r.id}?limit=10`, token);
        for (const o of rv?.reviews ?? []) {
          const t = `${o.title ?? ""} ${o.content ?? ""}`.trim();
          if (t) reviewsText.push(`(${o.rate ?? "?"}★) ${t}`);
        }
      } catch {
        /* reseñas restringidas */
      }
      try {
        const qs = await mlFetch(`/questions/search?item_id=${r.id}&limit=8&api_version=4`, token);
        for (const qq of qs?.questions ?? []) {
          if (qq?.text) questionsText.push(qq.text);
        }
      } catch {
        /* preguntas restringidas */
      }
    })
  );

  const comps: Comp[] = top.map((r) => ({
    id: r.id,
    title: r.title ?? "",
    price: typeof r.price === "number" ? r.price : 0,
    currency: r.currency_id ?? "",
    sold: typeof r.sold_quantity === "number" ? r.sold_quantity : 0,
    condition: r.condition === "used" ? "Usado" : r.condition === "not_specified" ? "" : "Nuevo",
    permalink: r.permalink ?? "",
    attrs: (r.attributes ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((a: any) => a.value_name)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((a: any) => `${a.name}: ${a.value_name}`)
      .slice(0, 12),
    description: (descById[r.id] ?? "").slice(0, 700),
  }));

  // Estadística de precios — determinística, sin gastar tokens.
  const prices = comps.map((c) => c.price).filter((p) => p > 0);
  const currency = comps.find((c) => c.currency)?.currency ?? "";
  const marketStats = prices.length
    ? {
        min: Math.min(...prices),
        max: Math.max(...prices),
        mediana: median(prices),
        moneda: currency,
        muestras: prices.length,
      }
    : null;

  // 4. FODA con Groq.
  const compContext = comps
    .map(
      (c, i) =>
        `#${i + 1} ${c.title}\nPrecio: ${c.price} ${c.currency} | Vendidos: ${c.sold} | ${c.condition || "s/d"}\nAtributos: ${c.attrs.join("; ") || "—"}\nDescripción: ${c.description || "—"}`
    )
    .join("\n\n");

  const mine = body.mine ?? {};
  const voice =
    [
      mine.producto && `Producto: ${mine.producto}`,
      mine.keyword && `Keyword objetivo: ${mine.keyword}`,
      mine.caracteristicas && `Características propias: ${mine.caracteristicas}`,
    ]
      .filter(Boolean)
      .join("\n") || "(el usuario no detalló su producto)";

  let foda = null;
  try {
    const completion = await groq.chat.completions.create(
      {
        model: DEFAULT_MODEL,
        temperature: 0.4,
        max_tokens: 1300,
        messages: [
          {
            role: "system",
            content:
              "Sos un analista de e-commerce experto en MercadoLibre LatAm. Analizás la competencia y devolvés SOLO un JSON válido, sin markdown ni texto extra. Basate ÚNICAMENTE en los datos provistos; no inventes datos.",
          },
          {
            role: "user",
            content: `Analizá la competencia de esta publicación y devolvé un FODA accionable para vender más.

MI PRODUCTO:
${voice}

COMPETIDORES (${comps.length}):
${compContext}

${reviewsText.length ? `RESEÑAS DE COMPRADORES:\n${reviewsText.slice(0, 25).join("\n")}\n` : ""}${questionsText.length ? `PREGUNTAS DE COMPRADORES:\n${questionsText.slice(0, 25).join("\n")}\n` : ""}
Devolvé SOLO este JSON (arrays de strings cortos y concretos, en español neutro; 2-4 ítems por lista; listas vacías si no hay datos):
{"resumen":"1-2 frases sobre el panorama competitivo","fortalezas":["ventajas que puedo explotar frente a la competencia"],"debilidades":["dónde la competencia me supera o riesgos de mi oferta"],"oportunidades":["huecos del mercado: atributos/keywords/ángulos que pocos usan"],"amenazas":["riesgos del mercado: guerra de precios, líderes consolidados, etc."],"keywords_top":["palabras clave que repiten los que más venden"],"atributos_sugeridos":["atributos de ficha que conviene completar para competir"],"quejas_comunes":["quejas o dudas recurrentes de compradores: SOLO si hay reseñas o preguntas arriba"],"recomendaciones":["acciones concretas para superar a la competencia"]}`,
          },
        ],
      },
      { timeout: 30000 }
    );
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
      foda = JSON.parse(cleaned);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) foda = JSON.parse(m[0]);
    }
  } catch {
    /* Groq caído → devolvemos igual marketStats + competidores */
  }

  return NextResponse.json({
    connected: true,
    available: true,
    marketStats,
    foda,
    competidores: comps.map((c) => ({
      title: c.title,
      price: c.price,
      currency: c.currency,
      sold: c.sold,
      permalink: c.permalink,
    })),
  });
}
