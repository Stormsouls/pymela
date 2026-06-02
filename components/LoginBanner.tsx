"use client";

import { useState } from "react";
import { BookMarked, Loader2, CheckCircle, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function LoginBanner() {
  const { user, isAnon, signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (!user || !isAnon || dismissed) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const result = await signInWithEmail(email);
    setLoading(false);
    if (result.error) setError(result.error);
    else setSent(true);
  }

  return (
    <div className="border-b border-indigo-100 bg-indigo-50 px-4 py-3">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
        <BookMarked className="h-4 w-4 shrink-0 text-indigo-500" />
        {sent ? (
          <span className="flex items-center gap-1.5 text-sm text-indigo-700">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            ¡Listo! Revisá tu email para confirmar.
          </span>
        ) : (
          <>
            <span className="text-sm text-indigo-700">
              <strong>Guardá tu historial</strong> — ingresá con tu email y nunca pierdas tus generaciones.
            </span>
            <form onSubmit={onSubmit} className="ml-auto flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none"
              />
              <button type="submit" disabled={loading}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Entrar"}
              </button>
            </form>
            {error && <span className="text-xs text-rose-600">{error}</span>}
          </>
        )}
        <button onClick={() => setDismissed(true)} className="text-indigo-400 hover:text-indigo-600">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
