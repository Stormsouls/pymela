"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Check, Download, FileDown, Loader2, Sparkles, RefreshCw, Link2, ScanSearch, ImageDown, Images, Zap } from "lucide-react";
import type { Bot } from "@/lib/bots";
import { BotIcon } from "./BotIcon";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useHistory } from "@/hooks/useHistory";

const FREE_USES = 9999; // sin límite por ahora

export function BotForm({ bot }: { bot: Bot }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapeHint, setScrapeHint] = useState<string | null>(null);
  const [scrapedImages, setScrapedImages] = useState<string[]>([]);
  const [downloadingAll, setDownloadingAll] = useState(false);

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
    try {
      const normalizedUrl = scrapeUrl.trim().replace(/\?$/, ""); // quitar ? al final

      // Paso 1: Jina Reader vía /api/jina (Edge function, 30s timeout, sin CORS)
      let jinaContent = "";
      try {
        const jinaRes = await fetch(`/api/jina?url=${encodeURIComponent(normalizedUrl)}`);
        if (jinaRes.ok) {
          const jinaData = await jinaRes.json();
          if (jinaData.code === 200 && jinaData.data) {
            const { title = "", description = "", content = "", extractedImages = [] } = jinaData.data;
            jinaContent = `Título: ${title}\nDescripción: ${description}\n\n${content}`.slice(0, 12000);
            if (Array.isArray(extractedImages) && extractedImages.length > 0) {
              setScrapedImages(extractedImages);
            }
          }
        }
      } catch { /* si falla, el servidor intenta fetch directo */ }

      // Paso 2: enviar al servidor (con el contenido de Jina si lo tenemos)
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl, content: jinaContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al scrapear");
      setValues((prev) => ({ ...prev, ...data.fields }));
      setScrapeHint(data.hint ?? null);
      setScrapeUrl("");
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setScrapeLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: bot.slug, values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar");
      setResult(data.text);
      bumpUses();
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

      {bot.slug === "preguntas-ml" && !result && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="text-sm">
            <span className="font-medium text-emerald-800">¿Vendés mucho en MercadoLibre? </span>
            <span className="text-emerald-700">Esta misma IA puede responder automáticamente todas tus preguntas, en segundos, sin que tengas que pegar nada.</span>
            <Link href="/conectar-ml" className="ml-1 font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-900">
              Conectá tu cuenta →
            </Link>
          </div>
        </div>
      )}

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
        </div>
      )}

      {/* Galería de imágenes scrapeadas */}
      {scrapedImages.length > 0 && !result && (
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
          <p className="mt-2 text-xs text-zinc-400">Clic en cada foto para descargarla individualmente.</p>
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
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-zinc-800">
              {result}
            </pre>
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? "¡Copiado!" : "Copiar"}
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
            <button
              onClick={reset}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              <RefreshCw className="h-4 w-4" />
              Generar otro
            </button>
          </div>

          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

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
        </div>
      )}
    </div>
  );
}
