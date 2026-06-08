import { Sparkles, Zap, ShieldCheck, BookMarked, ArrowRight } from "lucide-react";
import Link from "next/link";
import { BOTS } from "@/lib/bots";
import { BotCard } from "@/components/BotCard";
import { HeroBackground } from "@/components/HeroBackground";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-zinc-50">
      {/* Hero — oscuro, tecnológico, con constelación animada */}
      <section className="relative overflow-hidden bg-slate-950">
        {/* Fondo animado con parallax + formas flotantes */}
        <HeroBackground />

        <div className="relative z-10 mx-auto max-w-5xl px-5 pt-24 pb-28 text-center sm:pt-32">
          <span className="animate-fade-up inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-medium text-indigo-100 shadow-sm backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
            Herramientas de IA para tu negocio
          </span>

          <h1 className="animate-fade-up delay-100 mx-auto mt-7 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Las tareas de tu PyME,{" "}
            <span className="gradient-text">resueltas en segundos</span>.
          </h1>

          <p className="animate-fade-up delay-200 mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
            Respuestas en MercadoLibre, presupuestos, descripciones, cobranzas y documentos
            legales. Completás un formulario, listo. Sin saber nada de IA.
          </p>

          <div className="animate-fade-up delay-300 mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/conectar-ml"
              className="animate-pulse-ring group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/40 transition-transform hover:scale-105"
            >
              <Zap className="h-4 w-4" /> Auto-responder MercadoLibre
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#herramientas"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              Ver todas las herramientas
            </a>
          </div>

          <div className="animate-fade-up delay-500 mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-indigo-400" /> Sin instalar nada
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-indigo-400" /> Pensado para LatAm
            </span>
            <Link href="/historial" className="inline-flex items-center gap-1.5 text-indigo-300 hover:text-indigo-200 hover:underline">
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
