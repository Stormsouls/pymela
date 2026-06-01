// Constructores de prompts por bot. Solo se importan en el servidor (/api/generate).

type Values = Record<string, string>;

export type PromptSpec = {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
};

const BASE =
  "Escribís en español neutro profesional de Latinoamérica, claro y directo. " +
  "No uses markdown con asteriscos ni encabezados con #. Devolvé texto limpio listo para copiar y pegar.";

function descripciones(v: Values): PromptSpec {
  const esMl = !v.plataforma || v.plataforma.toLowerCase().includes("mercado");
  const esInstagram = v.plataforma?.toLowerCase().includes("instagram") || v.plataforma?.toLowerCase().includes("facebook");

  if (esInstagram) {
    return {
      temperature: 0.85,
      maxTokens: 1000,
      system:
        "Sos un experto en social commerce y copywriting para Instagram y Facebook en Latinoamérica. " +
        "Escribís con energía, emojis estratégicos y CTAs claros. Tono cercano pero profesional. " +
        BASE,
      user: `Generá una publicación de venta para Instagram/Facebook Marketplace.

Producto: ${v.producto}
Categoría: ${v.categoria || "(no especificada)"}
Condición: ${v.condicion}
Características: ${v.caracteristicas}

Devolvé exactamente esto:

CAPTION PRINCIPAL
[Hook de 1-2 líneas con emoji + descripción persuasiva de 3-5 líneas + CTA claro. Máximo 300 caracteres visibles antes del "ver más".]

DESCRIPCIÓN COMPLETA
[Versión extendida con emojis, puntos clave del producto, condición, precio si aplica, y CTA: "Escribinos", "Link en bio", "Disponible ahora".]

HASHTAGS
[20-25 hashtags relevantes: mezcla de nicho específico (#anilloInteligente), categoría (#tecnología), y locales (#argentinatech #ventasonline). Sin espacios entre ellos.]`,
    };
  }

  // MercadoLibre — formato SEO profesional
  return {
    temperature: 0.75,
    maxTokens: 1800,
    system:
      "Sos un experto en SEO y ventas para MercadoLibre en Latinoamérica. " +
      "Conocés las reglas del algoritmo de ML: el título determina el 80% del posicionamiento, " +
      "la descripción impacta en la conversión. " +
      "REGLAS DE TÍTULO ML: máximo 60 caracteres, formato [Marca] [Modelo] [Atributo1] [Atributo2] [Atributo3], " +
      "sin palabras promocionales (oferta, nuevo, urgente, liquidación, gratis), " +
      "sin signos de exclamación ni caracteres especiales excepto %, " +
      "incluir las palabras que el comprador tipea en el buscador. " +
      "REGLAS DE DESCRIPCIÓN ML: usar emojis como bullets y separadores de sección, " +
      "estructura clara con secciones diferenciadas, máximo 4000 caracteres, " +
      "incluir especificaciones técnicas completas, contenido del paquete, garantía, " +
      "mención de cuotas y envío. No usar HTML, solo texto plano + emojis. " +
      BASE,
    user: `Generá una publicación completa y SEO-optimizada para MercadoLibre.

Producto: ${v.producto}
Categoría: ${v.categoria || "(no especificada)"}
Condición: ${v.condicion}
Características: ${v.caracteristicas}

Devolvé EXACTAMENTE este formato (respetá los separadores y emojis de sección):

TÍTULO
[título de máximo 60 caracteres siguiendo las reglas de ML]

DESCRIPCIÓN
[Descripción completa con este esquema de secciones:

Primera línea: nombre del producto en mayúsculas con emoji llamativo (ej: 📱 NOMBRE DEL PRODUCTO)

Luego 3-5 beneficios principales con ✅:
✅ Beneficio 1
✅ Beneficio 2
...

Sección 📌 CARACTERÍSTICAS TÉCNICAS con cada spec en línea propia con 🔹

Sección 📦 CONTENIDO DEL PAQUETE con los items incluidos

Sección 🛡️ GARANTÍA con el tiempo/condiciones

Sección 💳 MEDIOS DE PAGO mencionando cuotas sin interés

Sección 🚚 ENVÍOS mencionando envío disponible a todo el país

Cierre con ❓ ¿TENÉS DUDAS? invitando a consultar por el chat]

PALABRAS CLAVE SEO
[12-15 términos de búsqueda que usa el comprador en ML, separados por coma. Incluir variantes: con y sin tilde, singular y plural, términos técnicos y coloquiales]

TÍTULO VARIANTE A/B
[Una variante alternativa del título para testear, también de máximo 60 caracteres]`,
  };
}

function resenas(v: Values): PromptSpec {
  return {
    temperature: 0.7,
    maxTokens: 600,
    system:
      "Sos un experto en atención al cliente y reputación online de negocios en Latinoamérica. " +
      "Respondés reseñas de forma humana, breve y profesional. " +
      "Si la reseña es positiva: agradecé con calidez y reforzá el vínculo. " +
      "Si es negativa: mostrá empatía real, hacete cargo sin excusas, ofrecé una solución e invitá a continuar en privado. " +
      "Nunca suenes robótico ni a plantilla. " +
      BASE,
    user: `Negocio: ${v.negocio}
Puntaje recibido: ${v.rating}
Tono de marca: ${v.tono || "Cercano"}

Reseña del cliente:
"""
${v.resena}
"""

Escribí UNA respuesta lista para publicar (máximo 5 oraciones). No incluyas títulos ni opciones, solo la respuesta.`,
  };
}

function cobranza(v: Values): PromptSpec {
  return {
    temperature: 0.6,
    maxTokens: 700,
    system:
      "Sos un experto en gestión de cobranzas para PyMEs de Latinoamérica. " +
      "Redactás emails que logran el pago preservando la relación comercial. " +
      "Ajustás el tono a la etapa indicada: amable mantiene la buena onda; firme marca la urgencia con respeto; " +
      "pre-legal es serio y menciona posibles acciones sin amenazar de forma agresiva. " +
      BASE,
    user: `Generá un email de cobranza.

Cliente que adeuda: ${v.cliente}
Monto adeudado: ${v.monto}
Días de atraso: ${v.dias}
Etapa / tono: ${v.tono}
Contexto: ${v.contexto || "(sin datos extra)"}

Devolvé:
ASUNTO: [asunto del email]

[cuerpo del email, breve y profesional, con un cierre que facilite el pago]`,
  };
}

function presupuestos(v: Values): PromptSpec {
  return {
    temperature: 0.4,
    maxTokens: 1500,
    system:
      "Sos un asistente que redacta presupuestos comerciales profesionales para PyMEs y freelancers de Latinoamérica. " +
      "Sos prolijo, formal y ordenado. Si los ítems traen precios, sumás el total con precisión. " +
      "Mostrás los montos en la moneda indicada. " +
      BASE,
    user: `Generá un presupuesto profesional con estos datos.

Emite: ${v.negocio}
Para el cliente: ${v.cliente}
Moneda: ${v.moneda}
Ítems (uno por línea):
${v.trabajo}
Condiciones: ${v.condiciones || "(usar condiciones estándar razonables)"}

Estructurá el presupuesto así:
- Encabezado con "PRESUPUESTO", quién lo emite y para quién.
- Fecha (usá la fecha de hoy de forma genérica como "Fecha: ___" si no la tenés).
- Detalle de ítems con su precio cada uno.
- SUBTOTAL y TOTAL en ${v.moneda} (calculá bien la suma si hay precios).
- Condiciones comerciales (validez, forma de pago, plazos).
- Cierre cordial.

Devolvé el presupuesto en texto plano prolijo, alineado y fácil de leer.`,
  };
}

function legales(v: Values): PromptSpec {
  return {
    temperature: 0.3,
    maxTokens: 2800,
    system:
      "Sos un asistente legal que redacta borradores de documentos para PyMEs de Latinoamérica, adaptados al país indicado. " +
      "Usás lenguaje jurídico claro y cláusulas numeradas. " +
      "SIEMPRE empezás el documento con una línea de aclaración: que es un borrador orientativo y no reemplaza el asesoramiento de un abogado matriculado. " +
      BASE,
    user: `Generá un borrador de: ${v.tipo}
País (usá su marco legal y terminología): ${v.pais}
Parte A: ${v.parte_a}
Parte B: ${v.parte_b || "(no aplica)"}
Detalle del acuerdo: ${v.detalle}

Redactá el documento completo con cláusulas numeradas, espacios para datos faltantes (con guiones bajos), y un cierre con lugar, fecha y firmas cuando corresponda. Empezá con la aclaración de que es un borrador orientativo.`,
  };
}

const BUILDERS: Record<string, (v: Values) => PromptSpec> = {
  descripciones,
  resenas,
  cobranza,
  presupuestos,
  legales,
};

export function buildPrompt(slug: string, values: Values): PromptSpec | null {
  const builder = BUILDERS[slug];
  return builder ? builder(values) : null;
}
