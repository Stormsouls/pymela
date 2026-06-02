"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Trash2, Copy, Check, BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHistory, type HistoryEntry } from "@/hooks/useHistory";
import { BOTS } from "@/lib/bots";
import { BotIcon } from "@/components/BotIcon";
import { cn } from "@/lib/utils";

export default function HistorialPage() {
  const { user, isAnon, signInWithEmail } = useAuth();
  const { getHistory, deleteEntry } = useHistory();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    if (user) {
      getHistory().then((data) => {
        setEntries(data);
        setLoading(false);
      });
    } else if (!loading) {
      setLoading(false);
    }
  }, [user, getHistory, loading]);

  async function handleDelete(id: string) {
    await deleteEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleCopy(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setEmailLoading(true);
    await signInWithEmail(email);
    setEmailLoading(false);
    setEmailSent(true);
  }

  function getBotMeta(slug: string) {
    return BOTS.find((b) => b.slug === slug);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  // Si no hay usuario aún, mostrar cargando
  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
      </main>
    );
  }

  // Si el usuario es anónimo, pedir email
  if (!user || isAnon) {
    return (
      <main className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-md px-5 py-20 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-zinc-300" />
          <h1 className="mt-4 text-2xl font-semibold text-zinc-900">Tu historial</h1>
          <p className="mt-2 text-zinc-500">Ingresá con tu email para ver y guardar todas tus generaciones.</p>
          {emailSent ? (
            <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              ✅ Revisá tu email y hacé clic en el link para entrar.
            </p>
          ) : (
            <form onSubmit={handleEmailSignIn} className="mt-6 flex gap-2">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com" required
                className="flex-1 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900" />
              <button type="submit" disabled={emailLoading}
                className="rounded-xl bg-zinc-900 px-4 py-2.5 font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                Entrar
              </button>
            </form>
          )}
          <Link href="/" className="mt-8 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900">
            <ArrowLeft className="h-4 w-4" /> Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900">
          <ArrowLeft className="h-4 w-4" /> Todas las herramientas
        </Link>
        <h1 className="mt-6 text-2xl font-semibold text-zinc-900">Historial</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {entries.length === 0 ? "Todavía no generaste nada." : `${entries.length} generación${entries.length !== 1 ? "es" : ""} guardada${entries.length !== 1 ? "s" : ""}.`}
        </p>

        {entries.length === 0 && (
          <div className="mt-10 text-center">
            <p className="text-zinc-400">Cuando generes contenido aparecerá acá.</p>
            <Link href="/" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800">
              Ir a las herramientas
            </Link>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {entries.map((entry) => {
            const bot = getBotMeta(entry.bot_slug);
            const isOpen = expanded === entry.id;
            return (
              <div key={entry.id} className="rounded-2xl border border-zinc-200 bg-white">
                <button
                  onClick={() => setExpanded(isOpen ? null : entry.id)}
                  className="flex w-full items-start gap-3 p-4 text-left"
                >
                  {bot && (
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", bot.accent)}>
                      <BotIcon name={bot.icon} className="h-4 w-4" />
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-900">{entry.bot_name}</p>
                    <p className="mt-0.5 truncate text-sm text-zinc-500">
                      {entry.output_text.slice(0, 80)}…
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-zinc-400 shrink-0">
                    <Clock className="h-3 w-3" />
                    {formatDate(entry.created_at)}
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-zinc-100 p-4">
                    <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700">
                      {entry.output_text}
                    </pre>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => handleCopy(entry.output_text, entry.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                        {copied === entry.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === entry.id ? "Copiado" : "Copiar"}
                      </button>
                      <Link href={`/${entry.bot_slug}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                        Generar nuevo
                      </Link>
                      <button onClick={() => handleDelete(entry.id)}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" /> Borrar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
