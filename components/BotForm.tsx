"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Check, Download, FileDown, Loader2, Sparkles, RefreshCw, Link2, ScanSearch, ImageDown, Images, ChevronDown, ExternalLink, Film, Globe, FolderTree, ShieldCheck, Target, TrendingUp, AlertTriangle, Lightbulb, ShieldAlert, Tag } from "lucide-react";
import type { Bot } from "@/lib/bots";
import { BotIcon } from "./BotIcon";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useHistory } from "@/hooks/useHistory";

const FREE_USES = 9999; // sin límite por ahora

// Encabezados que genera el bot de descripciones — permiten copiar cada bloque por separado.
const SECTION_HEADERS = [
  "TÍTULO",
  "TÍTULOS ALTERNATIVOS",
  "DESCRIPCIÓN",
  "FICHA TÉCNICA",
  "PALABRAS CLAVE SEO",
  "CAPTION PRINCIPAL",
  "DESCRIPCIÓN COMPLETA",
  "HASHTAGS",
];

// Evita que un timeout de función serverless (body vacío/truncado) reviente con
// el críptico "Unexpected end of JSON input" — lo convertimos en un mensaje claro.
async function safeJson(res: Response): Promise<any> {
  const raw = await res.text();
  if (!raw) throw new Error("El servidor no respondió a tiempo. Probá de nuevo en unos segundos.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("El servidor tardó demasiado en responder. Probá de nuevo en unos segundos.");
  }
}

type Section = { title: string; body: string };

type FodaResponse = {
  connected: boolean;
  available?: boolean;
  expired?: boolean;
  empty?: boolean;
  marketStats?: { min: number; max: number; mediana: number; moneda: string; muestras: number } | null;
  foda?: {
    resumen?: string;
    fortalezas?: string[];
    debilidades?: string[];
    oportunidades?: string[];
    amenazas?: string[];
    keywords_top?: string[];
    atributos_sugeridos?: string[];
    quejas_comunes?: string[];
    recomendaciones?: string[];
  } | null;
};

function parseSections(text: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (SECTION_HEADERS.includes(t)) {
      if (current) sections.push({ ...current, body: current.body.trim() });
      current = { title: t, body: "" };
    } else if (current) {
      current.body += line + "\n";
    }
  }
  if (current) sections.push({ ...current, body: current.body.trim() });
  return sections.filter((s) => s.body);
}

const ML_CHECKLIST: { title: string; detail: string; link?: string; linkLabel?: string }[] = [
  {
    title: "Subí 8-10 fotos profesionales",
    detail:
      "La primera foto define el clic desde los resultados: fondo blanco puro, producto bien iluminado ocupando ~85% del encuadre, sin textos ni logos encima (ML los penaliza). Las siguientes mostrá ángulos distintos, detalles de materiales, el producto en uso, las medidas con una referencia y el contenido de la caja. Más fotos de calidad = más confianza = más conversión, y la conversión es el factor #1 del algoritmo.",
  },
  {
    title: "Agregá un video corto (menos de 60 s)",
    detail:
      "Desde 2025 el algoritmo prioriza el contenido audiovisual: un video mostrando el producto funcionando aumenta el tiempo de permanencia y la conversión (hay reportes de +40%). Mostrá el producto real en uso, sus detalles y beneficios prácticos. No hace falta producción profesional: con el celular bien estabilizado y buena luz alcanza.",
  },
  {
    title: "Completá TODOS los atributos de la ficha técnica",
    detail:
      "Es el segundo factor de posicionamiento después del título. ML usa los atributos como datos estructurados para entender qué vendés y mostrarte en los filtros de búsqueda (marca, color, capacidad, etc.). Cada atributo vacío es una búsqueda en la que no aparecés. Usá la sección FICHA TÉCNICA que te generó el bot y completá también los \"sugeridos para completar\".",
  },
  {
    title: "Precio dentro de la mediana del mercado",
    detail:
      "Buscá tu producto en ML y mirá el precio de los que están en las primeras posiciones: ubicate cerca de la mediana, no del mínimo (regalar el precio rompe margen y genera desconfianza) ni del máximo. Evitá cambiar el precio seguido: cada cambio brusco reinicia parte de la relevancia que fuiste ganando.",
  },
  {
    title: "Activá Mercado Envíos (Full o Flex)",
    detail:
      "El tipo de envío pesa muchísimo. Full (ML almacena y despacha) es el estándar oro y aparece primero; Flex (despachás vos el mismo día) es la segunda mejor opción. Evitá dejar solo \"acordar con el comprador\": el algoritmo lo penaliza fuerte y baja tu visibilidad. El badge de envío gratis + cuotas sube el CTR.",
  },
  {
    title: "Respondé las preguntas en menos de 1 hora",
    detail:
      "La velocidad de respuesta es señal de buen vendedor para el algoritmo y mejora la conversión: muchos compran apenas les respondés. Mantener una tasa de respuesta alta habilita el indicador \"responde rápido\". Con Pymela podés conectar tu cuenta de MercadoLibre y dejar que el bot responda las preguntas por vos automáticamente, las 24 horas.",
    link: "/conectar-ml",
    linkLabel: "Activar respuestas automáticas",
  },
  {
    title: "No pauses la publicación",
    detail:
      "Pausar y reactivar reinicia el historial de relevancia que la publicación fue acumulando (ventas, visitas, antigüedad). Si te quedás sin stock conviene, casi siempre, bajar el stock a un mínimo o gestionarlo en vez de pausar. Una publicación con historial continuo rankea mejor que una nueva idéntica.",
  },
  {
    title: "Cuidá las primeras 48-72 horas",
    detail:
      "El algoritmo evalúa el desempeño inicial (visitas y ventas tempranas) para decidir cuánta exposición te da después. Para arrancar con impulso: compartí el link, asegurate de tener precio y fotos afinados desde el día uno, y considerá invertir un poco en Product Ads durante el lanzamiento para generar las primeras ventas que disparan el orgánico.",
  },
];

export function BotForm({ bot }: { bot: Bot }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedSection, setCopiedSection] = useState<number | null>(null);
  const [openChecklist, setOpenChecklist] = useState<number | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapeHint, setScrapeHint] = useState<string | null>(null);
  const [scrapedImages, setScrapedImages] = useState<string[]>([]);
  const [scrapedVideos, setScrapedVideos] = useState<string[]>([]);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [enfoqueIdx, setEnfoqueIdx] = useState(0);
  const [mlHost, setMlHost] = useState("www.mercadolibre.com.ar");
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{ atributos: { name: string; value: string }[]; fuentes: string[]; hint?: string } | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [categoryPath, setCategoryPath] = useState<{ path: string[]; domain?: string } | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [fodaLoading, setFodaLoading] = useState(false);
  const [foda, setFoda] = useState<FodaResponse | null>(null);

  const { user, isAnon, signInWithEmail } = useAuth();
  const { saveGeneration } = useHistory();
  const [histEmail, setHistEmail] = useState("");
  const [histEmailSent, setHistEmailSent] = useState(false);
  const [histEmailLoading, setHistEmailLoading] = useState(false);

  const set = (name: string, val: string) => setValues((v) => ({ ...v, [name]: val }));

  function usesLeft(): number {
    if (typeof window === "undefined") return FREE_USES;
    const used = Number(localStorage.getItem("pymela_uses") || "0");
    return Math.max(0, FREE_USES - used);
  }

  function bumpUses() {
    const used = Number(localStorage.getItem("pymela_uses") || "0");
    localStorage.setItem("pymela_uses", String(used + 1));
  }

  async function onScrape() {
    if (!scrapeUrl.trim()) return;
    setScrapeLoading(true);
    setScrapeError(null);
    setScrapeHint(null);

    const normalizedUrl = scrapeUrl.trim().replace(/\?$/, ""); // quitar ? al final
    let isML = false;
    try {
      const host = new URL(normalizedUrl).hostname;
      isML = host.includes("mercadolibre") || host.includes("mercadolivre");
      if (isML) setMlHost(host.replace(/^articulo\.|^www\./, "www."));
    } catch { /* ignorar */ }

    // Jina corre EN PARALELO (best-effort): aporta fotos/videos y, para sitios no-ML,
    // contenido rico para reextraer la ficha. No bloquea los campos: el usuario ve el
    // formulario completo apenas responde /api/scrape, y las fotos llegan después.
    const jinaPromise = fetch(`/api/jina?url=${encodeURIComponent(normalizedUrl)}`, {
      signal: AbortSignal.timeout(38000),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    let firstFields: Record<string, string> = {};
    let firstHint: string | null = null;
    let firstWeak = false; // true = el primer scrape no logró traer características
    try {
      // Campos al instante: scrape sin esperar a Jina. ML usa su API oficial; el resto,
      // fetch server-side + nombre del slug. Devuelve siempre rápido (~1-6s).
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl, content: "" }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Error al scrapear");
      firstFields = data.fields ?? {};
      firstHint = data.hint ?? null;
      firstWeak = !((firstFields.caracteristicas ?? "").trim());
      setValues((prev) => ({ ...prev, ...firstFields }));
      // No-ML sin specs: NO mostramos el hint negativo todavía. Jina puede completar la
      // ficha en segundo plano; el indicador "Buscando…" cubre la espera. Si tampoco lo
      // logra, el hint se muestra recién al final.
      setScrapeHint(!isML && firstWeak ? null : firstHint);
      // Fotos/videos desde el servidor (ej. ML vía API oficial).
      if (Array.isArray(data.images) && data.images.length > 0) {
        setScrapedImages((prev) => Array.from(new Set([...data.images, ...prev])).slice(0, 30));
      }
      if (Array.isArray(data.videos) && data.videos.length > 0) {
        setScrapedVideos((prev) => Array.from(new Set([...data.videos, ...prev])).slice(0, 3));
      }
      setScrapeUrl("");
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "Error inesperado");
      setScrapeLoading(false);
      return;
    }

    // Campos listos → formulario desbloqueado. Las fotos/datos siguen cargando en segundo plano.
    setScrapeLoading(false);
    setMediaLoading(true);
    let finalHint = firstHint;
    try {
      const jinaData = await jinaPromise;
      if (jinaData && jinaData.code === 200 && jinaData.data) {
        const { title = "", description = "", content = "", extractedImages = [], extractedVideos = [] } = jinaData.data;
        if (Array.isArray(extractedImages) && extractedImages.length > 0) {
          setScrapedImages((prev) => Array.from(new Set([...prev, ...extractedImages])).slice(0, 30));
        }
        if (Array.isArray(extractedVideos) && extractedVideos.length > 0) {
          setScrapedVideos((prev) => Array.from(new Set([...prev, ...extractedVideos])).slice(0, 3));
        }
        // No-ML que quedó sin specs: reextraemos la ficha con el contenido (renderizado) de
        // Jina y mejoramos los campos que el usuario no editó (slug/vacío → valor real).
        if (!isML && firstWeak && typeof content === "string" && content.trim().length > 300) {
          const jinaContent = `Título: ${title}\nDescripción: ${description}\n\n${content}`.slice(0, 12000);
          const res2 = await fetch("/api/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: normalizedUrl, content: jinaContent }),
          });
          const data2 = await safeJson(res2);
          if (res2.ok && data2.fields) {
            setValues((prev) => {
              const merged = { ...prev };
              for (const [k, v] of Object.entries(data2.fields as Record<string, string>)) {
                if (!v) continue;
                const userEdited = prev[k] !== undefined && (prev[k] ?? "") !== (firstFields[k] ?? "");
                if (!userEdited) merged[k] = v;
              }
              return merged;
            });
            const gotSpecs = !!((data2.fields.caracteristicas ?? "").trim() || (data2.fields.categoria ?? "").trim());
            finalHint = gotSpecs
              ? "Datos del link cargados. Revisá que sean correctos antes de generar."
              : (data2.hint ?? firstHint);
          }
        }
      }
    } catch { /* best-effort: si Jina falla, los campos del primer scrape ya están */ }
    finally {
      // Hint definitivo: para no-ML sin specs reflejamos el resultado de la reextracción.
      if (!isML && firstWeak) setScrapeHint(finalHint);
      setMediaLoading(false);
    }
  }

  async function runGenerate(enfoque: number) {
    setError(null);
    setResult(null);
    setEnrichResult(null);
    setEnrichError(null);
    setCategoryPath(null);
    setFoda(null);
    setLoading(true);
    try {
      // Para descripciones pasamos el enfoque para que "otra versión" cambie el ángulo SEO.
      const payload = bot.slug === "descripciones" ? { ...values, _enfoque: String(enfoque) } : values;
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: bot.slug, values: payload }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Error al generar");
      setResult(data.text);
      bumpUses();
      // Árbol de categorías exacto donde publicar en ML (predictor oficial de ML).
      // Fire-and-forget: no bloquea el resultado ya mostrado.
      if (bot.slug === "descripciones" && (values.plataforma ?? "").includes("Mercado")) {
        const q = `${values.keyword || values.producto || ""} ${values.marca || ""}`.trim();
        if (q) {
          setCategoryLoading(true);
          fetch("/api/ml-category", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q, host: mlHost }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d && Array.isArray(d.path) && d.path.length) setCategoryPath({ path: d.path, domain: d.domain }); })
            .catch(() => { /* sin categoría: no rompe nada */ })
            .finally(() => setCategoryLoading(false));

          // Análisis de competencia (FODA): busca publicaciones del mismo producto,
          // lee descripciones + reseñas/preguntas y arma un FODA. Requiere cuenta ML
          // conectada (search exige token). Fire-and-forget: no bloquea el resultado.
          setFodaLoading(true);
          fetch("/api/competitors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              q,
              host: mlHost,
              mine: { producto: values.producto, keyword: values.keyword, caracteristicas: values.caracteristicas },
            }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d) setFoda(d as FodaResponse); })
            .catch(() => { /* sin análisis: no rompe nada */ })
            .finally(() => setFodaLoading(false));
        }
      }
      // Guardar en historial si el usuario tiene sesión
      if (user) {
        saveGeneration({
          bot_slug: bot.slug,
          bot_name: bot.name,
          input_values: values,
          output_text: data.text,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnfoqueIdx(0);
    await runGenerate(0);
  }

  // "Otra versión": mismo producto, distinto enfoque SEO (rota entre 4 ángulos).
  async function regenerate() {
    const next = enfoqueIdx + 1;
    setEnfoqueIdx(next);
    await runGenerate(next);
  }

  // Busca specs reales en la web para completar la ficha (sin inventar).
  async function enrichFicha(fichaBody: string) {
    setEnrichLoading(true);
    setEnrichError(null);
    setEnrichResult(null);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ producto: values.producto, marca: values.marca, existing: fichaBody }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Error al buscar specs");
      setEnrichResult(data);
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setEnrichLoading(false);
    }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function downloadTxt() {
    if (!result) return;
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bot.slug}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPdf() {
    if (!result) return;
    setPdfLoading(true);
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: bot.name, text: result }),
      });
      if (!res.ok) throw new Error("No se pudo generar el PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bot.slug}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setEnrichResult(null);
    setEnrichError(null);
    setFoda(null);
  }

  async function downloadImage(imgUrl: string, index: number) {
    const ext = imgUrl.split("?")[0].split(".").pop()?.toLowerCase() ?? "jpg";
    const filename = `${bot.slug}-foto-${index + 1}.${ext}`;
    const a = document.createElement("a");
    a.href = `/api/img?url=${encodeURIComponent(imgUrl)}&filename=${encodeURIComponent(filename)}`;
    a.download = filename;
    a.click();
  }

  async function downloadAllImages() {
    setDownloadingAll(true);
    for (let i = 0; i < scrapedImages.length; i++) {
      await downloadImage(scrapedImages[i], i);
      // Pequeño delay para que el browser no bloquee múltiples descargas
      await new Promise((r) => setTimeout(r, 400));
    }
    setDownloadingAll(false);
  }

  const left = usesLeft();

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" />
        Todas las herramientas
      </Link>

      <div className="mt-6 flex items-start gap-4">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", bot.accent)}>
          <BotIcon name={bot.icon} className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{bot.name}</h1>
          <p className="mt-1 text-zinc-500">{bot.description}</p>
        </div>
      </div>

      {!result && bot.scrapeUrl && (
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <Link2 className="h-4 w-4 text-zinc-400" />
            Completar desde un link <span className="font-normal text-zinc-400">(opcional)</span>
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Pegá la URL del producto en MercadoLibre, Amazon, una tienda online u otro marketplace y completamos los campos por vos.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="url"
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              placeholder="https://articulo.mercadolibre.com.ar/..."
              className="flex-1 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onScrape())}
            />
            <button
              type="button"
              onClick={onScrape}
              disabled={scrapeLoading || !scrapeUrl.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {scrapeLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanSearch className="h-4 w-4" />
              )}
              {scrapeLoading ? "Leyendo…" : "Completar"}
            </button>
          </div>
          {scrapeError && (
            <p className="mt-2 text-xs text-rose-600">{scrapeError}</p>
          )}
          {scrapeHint && (
            <p className="mt-2 text-xs text-amber-600">⚠ {scrapeHint}</p>
          )}
          {mediaLoading && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Buscando fotos y datos del producto… podés ir completando mientras tanto.
            </p>
          )}
        </div>
      )}

      {!result && (
        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          {bot.fields.map((f) => (
            <div key={f.name}>
              <label className="block text-sm font-medium text-zinc-800">
                {f.label}
                {f.required && <span className="text-rose-500"> *</span>}
              </label>
              {f.help && <p className="mt-0.5 text-xs text-zinc-400">{f.help}</p>}

              {f.type === "textarea" ? (
                <textarea
                  value={values[f.name] || ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  placeholder={f.placeholder}
                  rows={4}
                  required={f.required}
                  className="mt-1.5 w-full resize-y rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              ) : f.type === "select" ? (
                <select
                  value={values[f.name] || ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  required={f.required}
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                >
                  <option value="" disabled>
                    Elegí una opción…
                  </option>
                  {f.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === "number" ? "number" : "text"}
                  value={values[f.name] || ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  placeholder={f.placeholder}
                  required={f.required}
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              )}
            </div>
          ))}

          {error && (
            <p className="rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || left <= 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generando…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> {bot.cta}
              </>
            )}
          </button>

          <p className="text-center text-xs text-zinc-400">
            {left > 0 ? `Te ${left === 1 ? "queda" : "quedan"} ${left} ${left === 1 ? "prueba gratis" : "pruebas gratis"}` : "Se acabaron tus pruebas gratis"}
          </p>
        </form>
      )}

      {result && (
        <div className="mt-8">
          {(() => {
            const sections = bot.slug === "descripciones" ? parseSections(result) : [];
            if (sections.length < 2) {
              return (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-zinc-800">
                    {result}
                  </pre>
                </div>
              );
            }
            return (
              <div className="space-y-3">
                {sections.map((s, i) => (
                  <div key={i} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{s.title}</p>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(s.body).then(() => {
                            setCopiedSection(i);
                            setTimeout(() => setCopiedSection(null), 1800);
                          }).catch(() => { /* clipboard no disponible */ });
                        }}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                      >
                        {copiedSection === i ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        {copiedSection === i ? "¡Copiado!" : "Copiar"}
                      </button>
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-zinc-800">
                      {s.body}
                    </pre>

                    {/* Enriquecer ficha con specs reales de la web */}
                    {s.title === "FICHA TÉCNICA" && (
                      <div className="mt-3 border-t border-zinc-200 pt-3">
                        <button
                          type="button"
                          onClick={() => enrichFicha(s.body)}
                          disabled={enrichLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                        >
                          {enrichLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                          {enrichLoading ? "Buscando en la web…" : "Buscar más specs en internet"}
                        </button>
                        <p className="mt-1 text-[11px] text-zinc-400">Busca datos reales en la web. Verificá siempre que coincidan con tu producto antes de publicar.</p>

                        {enrichError && <p className="mt-2 text-xs text-rose-600">{enrichError}</p>}

                        {enrichResult && enrichResult.atributos.length > 0 && (
                          <div className="mt-3 rounded-xl border border-indigo-100 bg-white p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-indigo-700">{enrichResult.atributos.length} specs encontradas en la web</p>
                              <button
                                type="button"
                                onClick={() => {
                                  const txt = enrichResult.atributos.map((a) => `${a.name}: ${a.value}`).join("\n");
                                  navigator.clipboard.writeText(txt).catch(() => {});
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
                              >
                                <Copy className="h-3 w-3" /> Copiar
                              </button>
                            </div>
                            <ul className="mt-2 space-y-1">
                              {enrichResult.atributos.map((a, k) => (
                                <li key={k} className="text-sm text-zinc-800">
                                  <span className="font-medium">{a.name}:</span> {a.value}
                                </li>
                              ))}
                            </ul>
                            {enrichResult.fuentes.length > 0 && (
                              <p className="mt-2 text-[11px] text-zinc-400">
                                Fuentes:{" "}
                                {enrichResult.fuentes.map((f, k) => (
                                  <a key={k} href={f} target="_blank" rel="noopener noreferrer" className="mr-1 underline hover:text-zinc-600">[{k + 1}]</a>
                                ))}
                              </p>
                            )}
                          </div>
                        )}
                        {enrichResult && enrichResult.atributos.length === 0 && (
                          <p className="mt-2 text-xs text-amber-600">{enrichResult.hint ?? "No encontramos specs confiables en la web. Completá los atributos manualmente."}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Árbol de categorías exacto donde publicar en ML */}
          {categoryPath && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <FolderTree className="h-4 w-4" /> Dónde publicarlo en MercadoLibre
              </p>
              <p className="mt-1.5 text-sm font-medium text-emerald-900">
                {categoryPath.path.join("  ›  ")}
              </p>
              <p className="mt-1.5 text-[11px] text-emerald-700/80">
                Categoría que sugiere MercadoLibre para este producto. Al publicar, confirmala: a veces hay una variante más específica.
              </p>
            </div>
          )}
          {categoryLoading && !categoryPath && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando la categoría exacta en MercadoLibre…
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? "¡Copiado!" : "Copiar todo"}
            </button>
            <button
              onClick={downloadPdf}
              disabled={pdfLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Descargar PDF
            </button>
            <button
              onClick={downloadTxt}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Download className="h-4 w-4" />
              .txt
            </button>

            {bot.slug === "descripciones" && (values.plataforma ?? "").includes("Mercado") && (
              <a
                href={`https://${mlHost}/vender`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-600"
              >
                <ExternalLink className="h-4 w-4" />
                Publicar en MercadoLibre
              </a>
            )}

            <div className="ml-auto flex flex-wrap gap-2.5">
              {bot.slug === "descripciones" && (
                <button
                  onClick={regenerate}
                  disabled={loading}
                  title="Genera otra versión con un enfoque distinto, siempre optimizada para posicionar"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Otra versión
                </button>
              )}
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                <RefreshCw className="h-4 w-4" />
                {bot.slug === "descripciones" ? "Editar datos" : "Generar otro"}
              </button>
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

          {/* Fotos y video del producto — se ofrecen después de la descripción */}
          {scrapedImages.length > 0 && (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                  <Images className="h-4 w-4 text-zinc-400" />
                  {scrapedImages.length} foto{scrapedImages.length !== 1 ? "s" : ""} encontrada{scrapedImages.length !== 1 ? "s" : ""}
                </p>
                <button
                  type="button"
                  onClick={downloadAllImages}
                  disabled={downloadingAll}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                >
                  {downloadingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageDown className="h-3 w-3" />}
                  {downloadingAll ? "Descargando…" : "Descargar todas"}
                </button>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {scrapedImages.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => downloadImage(img, i)}
                    title="Clic para descargar"
                    className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-white"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt={`Foto ${i + 1}`}
                      className="h-full w-full object-cover transition-opacity group-hover:opacity-70"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                      <Download className="h-4 w-4 text-zinc-700" />
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-zinc-400">Clic en cada foto para descargarla. Subí 8-10 a tu publicación (la primera, fondo blanco).</p>
            </div>
          )}

          {scrapedVideos.length > 0 && (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                <Film className="h-4 w-4 text-zinc-400" />
                {scrapedVideos.length} video{scrapedVideos.length !== 1 ? "s" : ""} del producto
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {scrapedVideos.map((vid, i) => (
                  <div key={i} className="overflow-hidden rounded-lg border border-zinc-200 bg-black">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video src={vid} controls preload="metadata" className="aspect-video w-full bg-black" />
                    <a
                      href={`/api/img?url=${encodeURIComponent(vid)}&filename=${encodeURIComponent(`${bot.slug}-video-${i + 1}.mp4`)}`}
                      download
                      className="flex items-center justify-center gap-1.5 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
                    >
                      <Download className="h-3 w-3" />
                      Descargar video
                    </a>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-zinc-400">Un video corto (menos de 60 s) sube la conversión y el posicionamiento.</p>
            </div>
          )}

          {/* Checklist de posicionamiento — solo descripciones para ML */}
          {bot.slug === "descripciones" && (values.plataforma ?? "").includes("Mercado") && (
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <p className="text-sm font-semibold text-emerald-800">
                📈 Checklist para posicionar tu publicación
              </p>
              <p className="mt-0.5 text-xs text-emerald-700/70">
                El texto es la mitad del trabajo — esto completa el resto del algoritmo de MercadoLibre.
              </p>
              <ul className="mt-3 space-y-1.5">
                {ML_CHECKLIST.map((item, i) => {
                  const open = openChecklist === i;
                  return (
                    <li key={i} className="rounded-xl border border-emerald-100 bg-white/60">
                      <button
                        type="button"
                        onClick={() => setOpenChecklist(open ? null : i)}
                        aria-expanded={open}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-emerald-900"
                      >
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span className="flex-1 font-medium">{item.title}</span>
                        <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-emerald-500 transition-transform", open && "rotate-180")} />
                      </button>
                      {open && (
                        <div className="px-3 pb-3 pl-8">
                          <p className="text-xs leading-relaxed text-emerald-800/80">{item.detail}</p>
                          {item.link && (
                            <Link
                              href={item.link}
                              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                              <Sparkles className="h-3 w-3" />
                              {item.linkLabel}
                            </Link>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Prompt historial inline — solo para usuarios anónimos */}
          {isAnon && (
            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
              {histEmailSent ? (
                <p className="text-sm text-indigo-700">✅ Revisá tu email para guardar el historial.</p>
              ) : (
                <>
                  <p className="text-sm text-indigo-700">
                    <strong>¿Querés guardar esta generación?</strong> Ingresá tu email — guardamos todo tu historial.
                  </p>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setHistEmailLoading(true);
                      await signInWithEmail(histEmail);
                      setHistEmailLoading(false);
                      setHistEmailSent(true);
                    }}
                    className="mt-2 flex gap-2"
                  >
                    <input
                      type="email"
                      value={histEmail}
                      onChange={(e) => setHistEmail(e.target.value)}
                      placeholder="tu@email.com"
                      required
                      className="flex-1 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none"
                    />
                    <button type="submit" disabled={histEmailLoading}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                      {histEmailLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar"}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          <p className="mt-6 flex items-start gap-1.5 border-t border-zinc-100 pt-3 text-[11px] leading-relaxed text-zinc-400">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Pymela arma un borrador con la información disponible y puede tener imprecisiones. Revisá precio, especificaciones y datos antes de publicar.</span>
          </p>
        </div>
      )}
    </div>
  );
}
