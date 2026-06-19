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

## Credenciales Vercel
- Scope / team: `cuentaparaubersuggest-4423s-projects`
- Project ID: `prj_pXDcWEHuQN3dIZAw9MmBrMW1KdVw`
- URL producción: **https://pymela.vercel.app**
- GROQ_API_KEY: cargada como env var encrypted (production + preview + development)
- Deploy: `vercel --token <token> --prod --yes --scope cuentaparaubersuggest-4423s-projects`

## Supabase
- Project ref: `vudtvffjpoiiukajseuh`
- URL: `https://vudtvffjpoiiukajseuh.supabase.co`
- Región: South America (São Paulo)
- DB password: `PymelaDB2026!`
- Tabla: `generations` (id, user_id, ip_hash, bot_slug, created_at) con RLS
- Gating: 3 generaciones / 24h por IP hash (SHA-256 + salt). Sin auth por ahora.
- `lib/supabase-server.ts` — `checkAndRecordGeneration(ip, slug)` con service_role

## Bot descripciones ML — mejora SEO mayor (2026-06-13)
Auditoría SEO ML 2026 + reescritura completa. Deployado a prod y verificado end-to-end.
- **Prompt nuevo** (`lib/prompts.ts`): keyword del comprador al frente del título (primeros 45 chars visibles en mobile), primeras 3 líneas de descripción repiten keyword, sección FICHA TÉCNICA (atributos `Atributo: Valor` — 2º factor de ranking ML), FAQ 3-5 preguntas, sección ESTADO para usados/reacondicionados, 2 títulos alternativos para A/B.
- **Compliance ML**: prohíbe datos de contacto/URLs/redes (los elimina aunque vengan en el input — verificado con trampa), prohíbe keyword stuffing. Guard anti-invención de specs (`NO_INVENTAR`, compartido con branch Instagram).
- **Campos nuevos en form** (`lib/bots.ts`): marca, keyword ("¿cómo lo buscaría tu comprador?"), envío, cuotas, garantía. Si no se completan → frases neutras (nunca promete cuotas sin interés/envío gratis/garantía no confirmados; garantía vacía = sección omitida).
- **Validación server-side 60 chars** (`app/api/generate/route.ts`, `enforceMlTitleLimit`): parsea TÍTULO + TÍTULOS ALTERNATIVOS, si alguno >60 hace segunda pasada Groq para acortar (fallback: truncado por palabra). Solo corre para slug descripciones; el branch Instagram no tiene línea "TÍTULO" así que no lo toca.
- **BotForm**: resultado parseado en secciones con botón copiar individual (headers en `SECTION_HEADERS`) + checklist estático de posicionamiento ML (fotos/video/Full/precio/48hs — cero costo de tokens).
- temperature 0.75→0.65, maxTokens 1800→2400.

## Bot descripciones ML — fotos/videos/ficha-internet (2026-06-14)
- **/api/enrich** (nuevo): completa la ficha con specs reales de la web. DuckDuckGo HTML
  leído con Jina Reader (r.jina.ai) + extracción con Groq sin inventar + cita fuentes.
  UI: botón "Buscar más specs en internet" en la sección FICHA.
- **Fotos** (/api/jina): alta resolución mlstatic (2X/-O), dedupe por id de producto,
  prioriza fotos del producto, hasta 30.
- **Videos** (/api/jina): extrae videos propios descargables (mp4/webm + clips ML).
  No YouTube/terceros (no descargables). Galería con preview + descarga vía /api/img.
- **ML scraping** (/api/scrape `handleMercadoLibre`): la API pública de ML da 403 y el
  scraping anónimo está bloqueado por anti-bot (incluso el browser engine de Jina trae
  página vacía de 256 chars). Solución: si hay cookie OAuth (`getVerifiedMlUid`), trae
  datos + fotos HD vía API oficial (getItem); si no, hint para pegar link del proveedor
  o conectar la cuenta.
- ✅ **JINA_API_KEY** en Vercel y funcionando. /api/enrich ahora usa Jina Search
  (`s.jina.ai`) en lugar de DuckDuckGo HTML (que estaba bloqueado desde datacenter Vercel).
  Verificado en prod: 15 atributos + 3 fuentes para Samsung Galaxy A54.
  Nota: env var tenía BOM (U+FEFF) que rompía el header HTTP → recargada con `printf '%s'`
  y stripeo defensivo en código (`getJinaKey()` en `app/api/enrich/route.ts`).
- Para fotos de ML específicamente: conectar la cuenta en /conectar-ml (OAuth).

## Bot descripciones ML — fixes UX/producción (2026-06-17)
- **Filtrado de imágenes irrelevantes** (`app/api/jina/route.ts`): `BLOCKED_HOSTS` (ads/tracking),
  `EXCLUDE_KEYWORDS` (iconos/logos/banderas/badges/payments/sociales), exclusión SVG, check de
  dimensiones en filename (WxH < 200px = icono), alt-text matching, y match de hostname exacto/subdominio
  (evita falso positivo: `"licdn.com"` bloqueaba `"alicdn.com"` vía substring).
- **`maxDuration = 60`** añadido a `/api/scrape` y `/api/generate` → ya estaba en jina y enrich.
  Previene timeout de Vercel (~10s default) en llamadas lentas a Groq/Jina → causaba respuesta
  vacía que el cliente no podía parsear.
- **`safeJson()` helper** en `components/BotForm.tsx`: reemplaza `res.json()` directo en las 3
  llamadas (scrape/generate/enrich). `res.text()` + `JSON.parse()` manual con mensajes de error
  en español si el body viene vacío o cortado.
- **Galerías post-generación**: imágenes y video movidos del bloque `!result` (visible mientras
  está el form) al bloque `result && (...)` (visible sólo después de generar la descripción).

## Bot descripciones ML — fix "El servidor no respondió a tiempo" (2026-06-17)
- **Causa raíz**: al pegar un link, `/api/scrape` con `content:""` hace fetch server-side de
  la página (ej. Fravega/SPAs pesadas), obtiene >200 chars y llamaba a `extractWithGroq`
  **sin try/catch**. Cuando Groq fallaba (rate-limit de hora pico, etc.) la excepción no se
  capturaba → la función serverless moría con **HTTP 500 body vacío** → `safeJson()` en el
  cliente tiraba "El servidor no respondió a tiempo".
- **Fix** (`app/api/scrape/route.ts`): `extractWithGroq` ahora envuelve el call a Groq en
  try/catch (devuelve `null` ante cualquier throw) + `timeout: 25000` defensivo. El handler
  ya manejaba `null` → cae al nombre del slug + hint, devolviendo **200 con body válido**.
  Verificado en prod: el repro (fravega + content vacío) pasó de 500 size 0 a 200 estable x4.
- `/api/generate` ya tenía su Groq en try/catch (502 con body) — no afectado.

## Bot descripciones ML — scrape paralelo "todo en el menor tiempo" (2026-06-18)
- **Antes**: `onScrape` esperaba `/api/jina` (bloqueante, hasta 55s) ANTES de llamar a
  `/api/scrape`. El usuario miraba un spinner ~50s antes de ver cualquier campo.
- **Ahora** (`components/BotForm.tsx`): Jina y scrape corren **en paralelo**. Se hace
  `await` de `/api/scrape` (content vacío) primero → los **campos aparecen en ~1.8s** y el
  form se desbloquea (`setScrapeLoading(false)`). Jina sigue en segundo plano (`mediaLoading`)
  y al volver agrega fotos/videos. Para sitios no-ML con contenido rico (>800 chars) hace una
  segunda pasada a `/api/scrape` con el content de Jina para mejorar la ficha, mergeando solo
  los campos que el usuario NO editó (compara contra `firstFields`).
- Indicador UI nuevo: "Buscando fotos del producto… podés ir completando mientras tanto."
- **Jina timeout bajado** (`app/api/jina/route.ts`): X-Timeout 45→30, AbortSignal 55s→35s.
  Las SPAs pesadas (AliExpress, Fravega) devolvían basura/vacío aun con 45s, así que no se
  pierde nada útil y se acota la espera de fotos. Verificado en prod: jina 48s→35s, scrape 1.8s.
- Costo: sitios no-ML con contenido rico pueden gastar hasta 2 llamadas a Groq (scrape inicial
  + reextracción). Despreciable a la escala actual; vigilar si crece (free tier Groq).
- **`producto` ("¿Qué estás vendiendo?") YA NO es required** (`lib/bots.ts`): se autocompleta
  desde el link y no debe bloquear el submit manualmente. NO volver a ponerle `required: true`.
  Required del bot descripciones quedan: plataforma, condicion, caracteristicas.

## Bot descripciones ML — extracción conserva marca/modelo + traduce (2026-06-18)
- **Síntoma**: link de Alibaba (Yawell R09) → el título salía "Anillo Inteligente Yawell" SIN
  el modelo R09, y el campo "Marca y modelo" quedaba vacío.
- **Causa**: el prompt de `extractWithGroq` (`app/api/scrape/route.ts`) solo extraía
  `{producto, categoria, condicion, caracteristicas}` — NO extraía `marca`, y resumía el
  nombre perdiendo el código de modelo (R09).
- **Fix**: el JSON de extracción ahora incluye `"marca"` y reglas: (1) conservar SIEMPRE el
  modelo/código (R09, A54, Pro Max) en `producto` y `marca`; (2) `producto` conciso pero
  completo; (3) devolver todo en español (waterproof→resistente al agua) sin traducir
  marcas/modelos. Verificado en prod: producto="Anillo Inteligente Yawell R09",
  marca="Yawell R09", caracteristicas en español. El builder de generación ya usaba `v.marca`,
  así el R09 ahora aparece en TÍTULO, descripción y ficha técnica.
- Nota deploy: el token del CLI de Vercel (auth.json) caduca (`expiresAt`); si da 403/"not
  valid", correr `vercel --prod` SIN `--token` deja que el CLI auto-refresque con el refreshToken.

## Estado actual (al cierre — 2026-05-31)
✅ Scaffolding Next.js 16 + Tailwind v4 + deps instaladas
✅ Registro de 5 bots + prompts LatAm + form dinámico
✅ Landing con grilla + sección de precios (free / Pro $5)
✅ /api/generate (Groq) probado end-to-end — funciona
✅ /api/pdf (pdf-lib) probado — devuelve PDF válido
✅ Gating free server-side (Supabase, 3/día por IP hash)
✅ `npm run build` pasa limpio (5 rutas SSG + 2 API)
✅ Repo GitHub: https://github.com/Stormsouls/pymela
✅ Deploy en Vercel: **https://pymela.vercel.app**
✅ Env vars Vercel: GROQ_API_KEY + NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
🔴 Sin auth de usuarios (login/register) — próximo paso
🔴 Sin historial de documentos generados
🔴 Sin pagos (plan Pro)
🔴 GitHub no conectado a Vercel (push manual por ahora)

## Próximos pasos (orden sugerido)
1. Conectar GitHub → Vercel desde el dashboard (auto-deploy en cada push).
2. Auth de usuarios: Supabase email magic link → historial propio por usuario.
2. Pulir copy/diseño de landing y de cada bot (el user cuida la estética).
3. Supabase: auth (anónimo o email) + tabla de generaciones (historial) + mover el gating de free de localStorage a server.
4. Pagos: MercadoPago (LatAm) + Stripe (USD) → desbloquear Pro ilimitado.
5. PDF branded (logo del negocio) para presupuestos/legales.
6. Versión Vision de "descripciones" (subir foto) cuando el resto esté validado.
7. Rotar la Groq key (no seguir con la de Bienestar en prod).
8. Marketing por vertical (arrancar por "vendedores de ML" o un rubro concreto).

---

## Seguridad (auditoría 2026-06-10)
**Patrón obligatorio**: TODA tabla nueva en Supabase debe llevar `enable row level security`
en su migration. Las tablas del proyecto se acceden SOLO desde el server con service_role
(que bypassa RLS), así que alcanza con habilitar RLS sin policies para anon/authenticated.
La anon key viaja en el bundle del cliente: una tabla sin RLS queda 100% abierta a lectura/escritura.

✅ Arreglado:
- Cookie de sesión ML (`pymela_ml_uid`) firmada con HMAC (`lib/ml-session.ts`), httpOnly+secure. Antes guardaba el ml_user_id público sin firma → account takeover.
- RLS habilitado en `ml_item_settings` y `rate_events` (estaban abiertas con anon key — leak de playbooks + bypass de rate-limit).
- Rate-limit anti-abuso (`lib/rate-limit.ts`, tabla `rate_events`): generate 20/min, scrape 15/min, pdf 20/min, jina 15/min, ml_items 12/min, ml_webhook 100/min.
- Security headers en `next.config.ts` (X-Frame-Options, CSP frame-ancestors, HSTS, nosniff, etc.).
- OAuth: nonce anti-CSRF en cookie (`ml_oauth_state`), validado en callback.
- Webhook ML: validación de `application_id` + anti-flood.
- Prompt-injection hardening: el texto del comprador va delimitado y tratado como no-instrucción.
- SSRF: `/api/scrape` y `/api/img` bloquean IPs privadas + metadata cloud (169.254.169.254).
- IDOR en `/api/ml/approve`: verifica pertenencia del draft a la cookie firmada.

✅ Tokens ML cifrados en reposo (AES-256-GCM, `lib/crypto.ts`, env `ML_TOKEN_ENC_KEY`).
   callback cifra al guardar; getFreshToken descifra al usar y recifra al refrescar.
   2 tokens existentes migrados. `decrypt` tiene fallback legacy (valores sin prefijo `v1:`).
   NOTA: la env `ML_TOKEN_ENC_KEY` en Vercel se cargó vía REST API (el CLI 54.x no toma stdin).
   El token del CLI de Vercel está en `%APPDATA%\xdg.data\com.vercel.cli\auth.json` (con comentarios // que hay que filtrar para parsear).

✅ GROQ_API_KEY rotada (2026-06-12): key nueva dedicada de Pymela cargada en Vercel (PATCH REST API) + .env.local + redeploy + verificada con /api/generate.

⚠ GROQ_API_KEY se invalidó (2026-06-18): la key del 2026-06-12 (`gsk_jiM7...6uUG`) pasó a
401 Invalid API Key → rompió TODO el flujo de IA (generate 502, scrape devolvía ficha vacía).
NO era bug de scrape/timeout. Diagnóstico: probar la key con
`curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer <key>"` (401 = muerta).
Rotada a key dedicada **"Pymela nueva 2"** (`gsk_CNmv...AWk`), cargada en Vercel (prod+preview+dev,
PATCH REST API env id `C7YBNGdfGqUYjj90`, teamId `team_6WTZYY18SStqxd3obbGQ4M8H`) + .env.local +
redeploy + verificada (generate 200, reextracción llena `caracteristicas`). Keys muertas:
`gsk_v5eY...Wl30` (Bienestar) y `gsk_jiM7...6uUG`. Método REST API para rotar documentado arriba.

🔴 Pendientes de seguridad:
1. Webhook usa procesamiento async sin `waitUntil` → confiabilidad (puede cortarse la respuesta antes de publicar). No es seguridad, es robustez.

## Regla permanente
Al final de cada sesión (o cuando el user pida cambiar de conversación), **actualizar este archivo**.
NO crear archivos nuevos de resumen — siempre actualizar este.
