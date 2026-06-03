"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, AlertCircle, Loader2, Zap, Power } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-client";

type MlConn = {
  ml_nickname: string;
  ml_user_id: string;
  auto_respond: boolean;
  created_at: string;
};

export default function ConectarMLPage() {
  const [conn, setConn] = useState<MlConn | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const error = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("error")
    : null;
  const success = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("success")
    : null;

  useEffect(() => {
    async function load() {
      const db = getSupabaseBrowser();
      const { data: { user } } = await db.auth.getUser();
      setUserId(user?.id ?? null);
      if (!user) { setLoading(false); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (db.from("ml_connections") as any)
        .select("ml_nickname, ml_user_id, auto_respond, created_at")
        .eq("user_id", user.id)
        .single();
      setConn(data ?? null);
      setLoading(false);
    }
    load();
  }, []);

  async function toggleAutoRespond() {
    if (!conn) return;
    setToggling(true);
    const db = getSupabaseBrowser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from("ml_connections") as any)
      .update({ auto_respond: !conn.auto_respond })
      .eq("ml_user_id", conn.ml_user_id);
    setConn({ ...conn, auto_respond: !conn.auto_respond });
    setToggling(false);
  }

  async function disconnect() {
    if (!conn) return;
    if (!confirm("¿Desconectar tu cuenta de MercadoLibre? Se dejarán de responder preguntas automáticamente.")) return;
    const db = getSupabaseBrowser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from("ml_connections") as any).delete().eq("ml_user_id", conn.ml_user_id);
    setConn(null);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-lg px-5 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900">
          <ArrowLeft className="h-4 w-4" /> Inicio
        </Link>

        <div className="mt-8">
          <h1 className="text-2xl font-semibold text-zinc-900">Respuestas automáticas en ML</h1>
          <p className="mt-2 text-zinc-500">
            Conectá tu cuenta y Pymela responderá las preguntas de tus compradores automáticamente, en segundos.
          </p>
        </div>

        {success && (
          <div className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-700">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">¡Cuenta conectada! Ya estás recibiendo respuestas automáticas.</span>
          </div>
        )}

        {error === "denied" && (
          <div className="mt-6 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-amber-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm">Cancelaste la autorización. Podés intentarlo de nuevo cuando quieras.</span>
          </div>
        )}

        {error && error !== "denied" && (
          <div className="mt-6 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm">Hubo un error al conectar. Intentá de nuevo.</span>
          </div>
        )}

        {conn ? (
          // Conectado
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <span className="font-medium text-emerald-800">Conectado como <strong>{conn.ml_nickname}</strong></span>
              </div>
              <p className="mt-1 text-sm text-emerald-700">
                Pymela está {conn.auto_respond ? "respondiendo preguntas automáticamente" : "en pausa — no responde preguntas"}.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-zinc-900">Respuesta automática</p>
                  <p className="mt-0.5 text-sm text-zinc-500">
                    {conn.auto_respond ? "Activada — respondemos en segundos" : "Pausada — las preguntas quedan sin responder"}
                  </p>
                </div>
                <button
                  onClick={toggleAutoRespond}
                  disabled={toggling}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${conn.auto_respond ? "bg-emerald-500" : "bg-zinc-200"} disabled:opacity-50`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${conn.auto_respond ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-5 text-sm text-zinc-500">
              <p className="font-medium text-zinc-700 mb-2">¿Cómo funciona?</p>
              <ul className="space-y-1.5">
                <li>✓ Un comprador hace una pregunta en tu publicación</li>
                <li>✓ MercadoLibre avisa a Pymela en tiempo real</li>
                <li>✓ La IA genera una respuesta en base al producto</li>
                <li>✓ Se publica automáticamente en segundos</li>
              </ul>
            </div>

            <button onClick={disconnect} className="text-sm text-zinc-400 hover:text-rose-600">
              <Power className="inline h-3.5 w-3.5 mr-1" />Desconectar cuenta
            </button>
          </div>
        ) : (
          // No conectado
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                  <Zap className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-zinc-900">Conectá tu cuenta de MercadoLibre</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Solo hacé clic, iniciá sesión en ML y autorizá. En 30 segundos estás recibiendo respuestas automáticas.
                  </p>
                </div>
              </div>

              <a
                href={`/api/ml/auth${userId ? `?user_id=${userId}` : ""}`}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-3 font-semibold text-zinc-900 transition-colors hover:bg-yellow-300"
              >
                <svg viewBox="0 0 48 48" className="h-5 w-5" fill="none">
                  <rect width="48" height="48" rx="8" fill="#FFE600" />
                  <text x="24" y="32" textAnchor="middle" fontSize="22" fontWeight="bold" fill="#3D2B1F">ML</text>
                </svg>
                Conectar con MercadoLibre
              </a>
            </div>

            <div className="text-sm text-zinc-400 space-y-1.5">
              <p>🔒 Solo accedemos a leer y responder preguntas — nada más.</p>
              <p>⚡ Tiempo de respuesta promedio: menos de 5 segundos.</p>
              <p>🔄 Podés pausar o desconectar en cualquier momento.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
