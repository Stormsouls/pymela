# Pymela — instrucciones permanentes y estado del proyecto

## LEER AL INICIO DE CADA CONVERSACIÓN
Leer este archivo entero antes de tocar nada.

---

## Qué es
Hub web de herramientas de IA para **PyMEs y emprendedores de LatAm**. La gente entra, completa
un formulario o sube datos, y descarga el output (texto / PDF). **SaaS, no se descarga el "motor".**
Diferencial: UX local + casos concretos + idioma/jerga regional, NO "tener IA" a secas.

Surgió como evolución de un bot de CVs previo. Se eligió la vertical **PyMEs** sobre "búsqueda laboral".

## Las 5 herramientas (bots) del MVP
1. **descripciones** — Descripciones para MercadoLibre/Instagram (texto). Ventas.
2. **resenas** — Respondedor de reseñas Google/ML/TripAdvisor (texto). Atención al cliente.
3. **cobranza** — Emails de cobranza escalonados (texto). Finanzas.
4. **presupuestos** — Presupuestos/cotizaciones en PDF (pdf). Administración. Reusa infra del CV bot.
5. **legales** — Contratos/NDA/políticas por país (pdf). Legal. Con disclaimer.

Descartados a propósito: posts/calendario de redes (compiten directo con ChatGPT free),
OCR tickets / transcripción audios (costo Vision/Whisper rompe márgenes), asistente Monotributo
(riesgo de alucinación con números legales). La versión Vision de "descripciones" (subir foto)
queda para más adelante; el MVP usa características tipeadas.

## Modelo de negocio
- **Free**: 3 generaciones gratis sin login (contador en localStorage, key `pymela_uses`).
- **Pro USD 5/mes**: ilimitado + PDF con logo + historial (pendientes). Pagos: MercadoPago + Stripe (no implementado aún).
- Futuro B2B/white-label (USD 20-50/mes por bot personalizado a contador/inmobiliaria/etc.) = mejores unit economics.
- Ojo unit economics: Groq free tier aguanta poco a escala; medir costo API por usuario activo antes de crecer.

## Stack
- **Next.js 16.2.6** (App Router, Turbopack) + React 19 + TypeScript
- **Tailwind v4** (sintaxis nueva: `@import "tailwindcss"`, `@theme inline` en globals.css)
- **Groq SDK** (`groq-sdk`), modelo `llama-3.3-70b-versatile`
- **pdf-lib** para PDFs (texto→PDF genérico, sin tildes especiales: hay sanitize a WinAnsi)
- **lucide-react** íconos, clsx + tailwind-merge (`cn`)
- Supabase: dependencias instaladas (`@supabase/supabase-js`, `@supabase/ssr`) pero **aún sin proyecto ni uso** (no hay auth/DB todavía)
- Deploy previsto: Vercel (no configurado aún)

## Paths
- Proyecto: `C:\Users\storm\Documents\Claude\Projects\pymela`
- `lib/bots.ts` — registro client-safe de los 5 bots (slug, campos del form, ícono, categoría, output text/pdf)
- `lib/prompts.ts` — constructores de prompt por bot (SOLO servidor; se importa en /api/generate)
- `lib/groq.ts` — cliente Groq + `DEFAULT_MODEL`
- `lib/utils.ts` — `cn()`
- `app/page.tsx` — landing (hero + grilla de bots + precios)
- `app/[slug]/page.tsx` — página dinámica por bot (usa generateStaticParams; `params` es Promise en Next 16)
- `app/api/generate/route.ts` — valida + arma prompt + llama Groq → `{ text }`
- `app/api/pdf/route.ts` — recibe `{ title, text }` → devuelve PDF A4
- `components/BotForm.tsx` — client component: form dinámico + resultado (copiar / PDF / .txt / generar otro) + gating free
- `components/BotCard.tsx`, `components/BotIcon.tsx` — UI

## Cómo agregar un bot nuevo
1. Agregar objeto al array `BOTS` en `lib/bots.ts` (slug, name, fields, icon, output, etc.).
2. Si el ícono es nuevo, sumarlo al `MAP` en `components/BotIcon.tsx`.
3. Agregar el builder de prompt en `lib/prompts.ts` (clave = slug) dentro de `BUILDERS`.
Listo — la página `/[slug]`, el form y la API lo toman solos.

## Credenciales / IDs
- **Groq key (MVP)**: en `.env.local`, REUSADA del proyecto Bienestar (`gsk_v5eY...Wl30`). Rotar antes de prod.
- Supabase: pendiente de crear proyecto.

## Comandos clave
```powershell
cd C:\Users\storm\Documents\Claude\Projects\pymela
npm run dev            # dev server (PORT por env; se probó en 3030)
npm run build          # build de producción (pasa OK)
```

## Estado actual (al cierre — 2026-05-29)
✅ Scaffolding Next.js 16 + Tailwind v4 + deps instaladas
✅ Registro de 5 bots + prompts LatAm + form dinámico
✅ Landing con grilla + sección de precios (free / Pro $5)
✅ /api/generate (Groq) probado end-to-end — funciona
✅ /api/pdf (pdf-lib) probado — devuelve PDF válido
✅ Gating free 3 usos (localStorage)
✅ `npm run build` pasa limpio (5 rutas SSG + 2 API)
✅ Commit local inicial hecho
🔴 Sin Supabase (auth/DB/historial), sin pagos, sin deploy, sin login
🔴 Repo remoto en GitHub: PENDIENTE (gh CLI no instalado; requiere login del user)

## Próximos pasos (orden sugerido)
1. Crear repo GitHub + push + deploy a Vercel (env var GROQ_API_KEY).
2. Pulir copy/diseño de landing y de cada bot (el user cuida la estética).
3. Supabase: auth (anónimo o email) + tabla de generaciones (historial) + mover el gating de free de localStorage a server.
4. Pagos: MercadoPago (LatAm) + Stripe (USD) → desbloquear Pro ilimitado.
5. PDF branded (logo del negocio) para presupuestos/legales.
6. Versión Vision de "descripciones" (subir foto) cuando el resto esté validado.
7. Rotar la Groq key (no seguir con la de Bienestar en prod).
8. Marketing por vertical (arrancar por "vendedores de ML" o un rubro concreto).

---

## Regla permanente
Al final de cada sesión (o cuando el user pida cambiar de conversación), **actualizar este archivo**.
NO crear archivos nuevos de resumen — siempre actualizar este.
