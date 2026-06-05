"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle, AlertCircle, Loader2, Zap, Power,
  Check, X, Edit2, Clock, BookOpen, Eye
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-client";

type MlConn = {
  id: string;
  ml_nickname: string;
  ml_user_id: string;
  auto_respond: boolean;
  review_mode: boolean;
  playbook: string;
  created_at: string;
};

type Draft = {
  id: string;
  question_text: string;
  item_title: string;
  draft_response: string;
  status: string;
  created_at: string;
};

export default function ConectarMLPage() {
  const [conn, setConn] = useState<MlConn | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [playbook, setPlaybook] = useState("");
  const [savingPlaybook, setSavingPlaybook] = useState(false);
  const [playbookSaved, setPlaybookSaved] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editingDraft, setEditingDraft] = useState<{ id: string; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const error = urlParams?.get("error");
  const success = urlParams?.get("success");

  const loadDrafts = useCallback(async (db: ReturnType<typeof getSupabaseBrowser>, uid: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (db.from("ml_drafts") as any)
      .select("id, question_text, item_title, draft_response, status, created_at")
      .eq("user_id", uid)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    setDrafts(data ?? []);
  }, []);

  useEffect(() => {
    async function load() {
      const db = getSupabaseBrowser();
      const { data: { user } } = await db.auth.getUser();
      setUserId(user?.id ?? null);
      if (!user) { setLoading(false); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (db.from("ml_connections") as any)
        .select("id, ml_nickname, ml_user_id, auto_respond, review_mode, playbook, created_at")
        .eq("user_id", user.id).single();
      if (data) {
        setConn(data);
        setPlaybook(data.playbook ?? "");
        await loadDrafts(db, user.id);
      }
      setLoading(false);
    }
    load();
  }, [loadDrafts]);

  async function toggle(field: "auto_respond" | "review_mode") {
    if (!conn) return;
    setToggling(field);
    const db = getSupabaseBrowser();
    const newVal = !conn[field];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from("ml_connections") as any)
      .update({ [field]: newVal }).eq("ml_user_id", conn.ml_user_id);
    setConn({ ...conn, [field]: newVal });
    setToggling(null);
  }

  async function savePlaybook() {
    if (!conn) return;
    setSavingPlaybook(true);
    const db = getSupabaseBrowser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from("ml_connections") as any)
      .update({ playbook }).eq("ml_user_id", conn.ml_user_id);
    setConn({ ...conn, playbook });
    setSavingPlaybook(false);
    setPlaybookSaved(true);
    setTimeout(() => setPlaybookSaved(false), 2500);
  }

  async function draftAction(draftId: string, action: "approve" | "reject" | "edit", editedText?: string) {
    setActionLoading(draftId + action);
    const res = await fetch("/api/ml/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft_id: draftId, action, edited_text: editedText }),
    });
    setActionLoading(null);
    if (res.ok) {
      setDrafts((d) => d.filter((x) => x.id !== draftId));
      setEditingDraft(null);
    }
  }

  async function disconnect() {
    if (!conn || !confirm("¿Desconectar tu cuenta de MercadoLibre?")) return;
    const db = getSupabaseBrowser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from("ml_connections") as any).delete().eq("ml_user_id", conn.ml_user_id);
    setConn(null);
  }

  if (loading) return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
    </main>
  );

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-2xl px-5 py-12">
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
            <span className="text-sm">Cancelaste la autorización.</span>
          </div>
        )}
        {error && error !== "denied" && (
          <div className="mt-6 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm">Hubo un error al conectar. Intentá de nuevo.</span>
          </div>
        )}

        {conn ? (
          <div className="mt-6 space-y-5">
            {/* Estado de conexión */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <span className="font-medium text-emerald-800">Conectado como <strong>{conn.ml_nickname}</strong></span>
              </div>
            </div>

            {/* Toggles */}
            <div className="rounded-2xl border border-zinc-200 bg-white divide-y divide-zinc-100">
              {[
                {
                  field: "auto_respond" as const,
                  label: "Respuesta automática",
                  desc: conn.auto_respond ? "Activada — respondemos en segundos" : "Pausada",
                },
                {
                  field: "review_mode" as const,
                  label: "Modo revisión",
                  desc: conn.review_mode
                    ? "Activado — guardamos los borradores para que los apruebes antes de publicar"
                    : "Desactivado — publicamos sin que tengas que revisar",
                },
              ].map(({ field, label, desc }) => (
                <div key={field} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-medium text-zinc-900">{label}</p>
                    <p className="mt-0.5 text-sm text-zinc-500">{desc}</p>
                  </div>
                  <button
                    onClick={() => toggle(field)}
                    disabled={toggling === field}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${conn[field] ? "bg-emerald-500" : "bg-zinc-200"} disabled:opacity-50`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${conn[field] ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              ))}
            </div>

            {/* Playbook */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-4 w-4 text-zinc-400" />
                <h3 className="font-medium text-zinc-900">Instrucciones para la IA</h3>
              </div>
              <p className="mb-3 text-sm text-zinc-500">
                Contale a la IA todo lo que necesita saber para responder bien: tus políticas, zonas de envío, garantías, cómo hablarle al cliente, preguntas frecuentes con sus respuestas, lo que quieras.
              </p>
              <textarea
                value={playbook}
                onChange={(e) => setPlaybook(e.target.value)}
                rows={6}
                placeholder={`Ejemplos:\n- Enviamos a todo el país por Mercado Envíos, en 3-5 días hábiles.\n- Garantía de 12 meses contra defectos de fábrica.\n- Aceptamos devoluciones en los primeros 30 días si el producto está sin uso.\n- Siempre terminar con "Cualquier consulta, estamos a disposición 👍"\n- Si preguntan por precio mayorista, decir que enviamos por privado.`}
                className="w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={savePlaybook}
                  disabled={savingPlaybook}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {savingPlaybook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Guardar instrucciones
                </button>
                {playbookSaved && (
                  <span className="flex items-center gap-1 text-sm text-emerald-600">
                    <Check className="h-3.5 w-3.5" /> Guardado
                  </span>
                )}
              </div>
            </div>

            {/* Borradores pendientes */}
            {conn.review_mode && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="h-4 w-4 text-zinc-400" />
                  <h3 className="font-medium text-zinc-900">
                    Borradores pendientes
                    {drafts.length > 0 && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {drafts.length}
                      </span>
                    )}
                  </h3>
                </div>

                {drafts.length === 0 ? (
                  <p className="text-sm text-zinc-400">No hay borradores pendientes.</p>
                ) : (
                  <div className="space-y-4">
                    {drafts.map((d) => (
                      <div key={d.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                        <div className="flex items-start gap-2 mb-2">
                          <Clock className="h-3.5 w-3.5 mt-0.5 text-zinc-400 shrink-0" />
                          <div>
                            <p className="text-xs text-zinc-400">{d.item_title}</p>
                            <p className="mt-1 text-sm font-medium text-zinc-800">❓ {d.question_text}</p>
                          </div>
                        </div>

                        {editingDraft?.id === d.id ? (
                          <div className="mt-3">
                            <textarea
                              value={editingDraft.text}
                              onChange={(e) => setEditingDraft({ id: d.id, text: e.target.value })}
                              rows={3}
                              className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                            />
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => draftAction(d.id, "edit", editingDraft.text)}
                                disabled={actionLoading === d.id + "edit"}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {actionLoading === d.id + "edit" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                Publicar editada
                              </button>
                              <button onClick={() => setEditingDraft(null)} className="text-xs text-zinc-400 hover:text-zinc-700">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="mt-2 rounded-lg bg-white border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
                              💬 {d.draft_response}
                            </div>
                            <div className="mt-3 flex gap-2 flex-wrap">
                              <button
                                onClick={() => draftAction(d.id, "approve")}
                                disabled={!!actionLoading}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {actionLoading === d.id + "approve" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                Publicar
                              </button>
                              <button
                                onClick={() => setEditingDraft({ id: d.id, text: d.draft_response })}
                                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                              >
                                <Edit2 className="h-3 w-3" /> Editar
                              </button>
                              <button
                                onClick={() => draftAction(d.id, "reject")}
                                disabled={!!actionLoading}
                                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-rose-600 hover:border-rose-200 disabled:opacity-50"
                              >
                                <X className="h-3 w-3" /> Descartar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Cómo funciona */}
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-5 text-sm text-zinc-500">
              <p className="font-medium text-zinc-700 mb-2">¿Cómo funciona?</p>
              <ul className="space-y-1.5">
                <li>✓ Un comprador hace una pregunta en tu publicación de ML</li>
                <li>✓ MercadoLibre avisa a Pymela en tiempo real</li>
                <li>✓ La IA genera una respuesta usando los datos del producto + tus instrucciones</li>
                <li>✓ {conn.review_mode ? "La guardamos para que la apruebes antes de publicar" : "Se publica automáticamente en segundos"}</li>
              </ul>
            </div>

            <button onClick={disconnect} className="text-sm text-zinc-400 hover:text-rose-600">
              <Power className="inline h-3.5 w-3.5 mr-1" />Desconectar cuenta
            </button>
          </div>
        ) : (
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
                ⚡ Conectar con MercadoLibre
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
