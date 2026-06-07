import { Sparkles, Zap, ShieldCheck, BookMarked, ArrowRight } from "lucide-react";
import Link from "next/link";
import { BOTS } from "@/lib/bots";
import { BotCard } from "@/components/BotCard";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-zinc-50">
      {/* Hero */}
      <section className="relative">
        {/* Animated background blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-300/40 blur-3xl animate-blob" />
          <div className="absolute right-0 top-10 h-96 w-96 rounded-full bg-purple-300/40 blur-3xl animate-blob delay-200" />
          <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-pink-300/30 blur-3xl animate-blob delay-500" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/40 to-zinc-50" />
        </div>

        <div className="mx-auto max-w-5xl px-5 pt-24 pb-20 text-center sm:pt-32">
          <span className="animate-fade-up glass inline-flex items-center gap-1.5 rounded-full border border-white/60 px-4 py-1.5 text-sm font-medium text-zinc-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            Herramientas de IA para tu negocio
          </span>

          <h1 className="animate-fade-up delay-100 mx-auto mt-7 max-w-3xl text-4xl font-bold tracking-tight text-zinc-900 sm:text-6xl">
            Las tareas de tu PyME,{" "}
            <span className="gradient-text">resueltas en segundos</span>.
          </h1>

          <p className="animate-fade-up delay-200 mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-500">
            Respuestas en MercadoLibre, presupuestos, descripciones, cobranzas y documentos
            legales. Completás un formulario, listo. Sin saber nada de IA.
          </p>

          <div className="animate-fade-up delay-300 mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/conectar-ml"
              className="animate-pulse-ring group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 transition-transform hover:scale-105"
            >
              <Zap className="h-4 w-4" /> Auto-responder MercadoLibre
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#herramientas"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-6 py-3 font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Ver todas las herramientas
            </a>
          </div>

          <div className="animate-fade-up delay-500 mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-500">
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
      <section id="herramientas" className="mx-auto max-w-6xl px-5 pb-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BOTS.map((bot, i) => (
            <BotCard key={bot.slug} bot={bot} index={i} />
          ))}
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="relative border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-900">
            Por ahora, <span className="gradient-text">todo gratis</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-zinc-500">
            Estamos en beta. Usá todas las herramientas sin límite, sin tarjeta, sin truco.
          </p>
          <div className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
            <div className="relative overflow-hidden rounded-3xl border-2 border-zinc-900 bg-white p-8 shadow-xl shadow-zinc-200/60">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-200/40 blur-2xl" />
              <div className="relative flex items-center gap-2">
                <h3 className="font-semibold text-zinc-900">Beta gratuita</h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Activo ahora</span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">Sin límites mientras estamos en beta.</p>
              <p className="mt-5 text-4xl font-bold text-zinc-900">
                $0<span className="text-base font-normal text-zinc-400">/mes</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm text-zinc-600">
                <li>✓ Generaciones ilimitadas</li>
                <li>✓ Acceso a todas las herramientas</li>
                <li>✓ Copiar, descargar PDF y fotos</li>
                <li>✓ Historial con tu email</li>
              </ul>
            </div>
            <div className="rounded-3xl border border-zinc-200 p-8 opacity-70 transition-opacity hover:opacity-100">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-zinc-900">Pro</h3>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">Próximamente</span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">Para tu negocio del día a día.</p>
              <p className="mt-5 text-4xl font-bold text-zinc-900">
                US$5<span className="text-base font-normal text-zinc-400">/mes</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm text-zinc-400">
                <li>Todo lo de Beta gratuita</li>
                <li>PDF con tu logo</li>
                <li>Soporte por WhatsApp</li>
                <li>Acceso anticipado a nuevas herramientas</li>
              </ul>
            </div>
          </div>
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
