import { Sparkles, Zap, ShieldCheck, BookMarked } from "lucide-react";
import Link from "next/link";
import { BOTS } from "@/lib/bots";
import { BotCard } from "@/components/BotCard";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-indigo-50 via-white to-zinc-50" />
        <div className="mx-auto max-w-5xl px-5 pt-20 pb-14 text-center sm:pt-28">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-600">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            Herramientas de IA para tu negocio
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            Tareas de tu PyME resueltas en segundos, sin saber nada de IA.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-zinc-500">
            Presupuestos, descripciones de productos, respuestas a reseñas, cobranzas y documentos
            legales. Completás un formulario, listo.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-indigo-500" /> Sin instalar nada
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-indigo-500" /> Pensado para LatAm
            </span>
            <Link href="/historial" className="inline-flex items-center gap-1.5 text-indigo-600 hover:underline">
              <BookMarked className="h-4 w-4" /> Guardá tu historial →
            </Link>
          </div>
        </div>
      </section>

      {/* Grilla de bots */}
      <section id="herramientas" className="mx-auto max-w-5xl px-5 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BOTS.map((bot) => (
            <BotCard key={bot.slug} bot={bot} />
          ))}
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-zinc-900">
            Simple y accesible
          </h2>
          <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 p-7">
              <h3 className="font-semibold text-zinc-900">Gratis</h3>
              <p className="mt-1 text-sm text-zinc-500">Para probar todas las herramientas.</p>
              <p className="mt-5 text-3xl font-semibold text-zinc-900">
                $0<span className="text-base font-normal text-zinc-400">/mes</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm text-zinc-600">
                <li>3 generaciones gratis</li>
                <li>Acceso a las 5 herramientas</li>
                <li>Copiar y descargar resultados</li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-zinc-900 p-7">
              <h3 className="font-semibold text-zinc-900">Pro</h3>
              <p className="mt-1 text-sm text-zinc-500">Para tu negocio del día a día.</p>
              <p className="mt-5 text-3xl font-semibold text-zinc-900">
                US$5<span className="text-base font-normal text-zinc-400">/mes</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm text-zinc-600">
                <li>Generaciones ilimitadas</li>
                <li>PDF con tu logo (pronto)</li>
                <li>Historial de documentos (pronto)</li>
                <li>Soporte por WhatsApp</li>
              </ul>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-zinc-400">
            Los planes pagos llegan pronto. Por ahora, probá todo gratis.
          </p>
        </div>
      </section>

      <footer className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-5xl px-5 py-8 text-center text-sm text-zinc-400">
          Pymela · Herramientas de IA para PyMEs y emprendedores de Latinoamérica
        </div>
      </footer>
    </main>
  );
}
