// Registro de bots — client-safe (sin imports de servidor).
// Los prompts viven en lib/prompts.ts y solo se usan en el endpoint /api/generate.

export type FieldType = "text" | "textarea" | "select" | "number";

export type BotField = {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  help?: string;
};

export type BotOutput = "text" | "pdf";

export type Bot = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: string; // nombre de icono lucide-react
  image: string; // URL de foto de portada (Unsplash, uso libre)
  category: string;
  accent: string; // clase tailwind para el acento de color
  output: BotOutput;
  cta: string;
  fields: BotField[];
  scrapeUrl?: boolean; // si true, muestra input de URL para pre-rellenar el form
};

export const BOTS: Bot[] = [
  {
    slug: "descripciones",
    name: "Descripciones para MercadoLibre",
    tagline: "Título y descripción para posicionar tu producto, en segundos.",
    description:
      "Convertí los datos de tu producto en un título y una descripción optimizados para posicionar mejor (SEO) y vender más en MercadoLibre. Listos para copiar y pegar.",
    icon: "ShoppingBag",
    image: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d",
    category: "Ventas",
    accent: "from-emerald-400 to-green-500",
    output: "text",
    cta: "Generar descripción",
    scrapeUrl: true,
    fields: [
      { name: "producto", label: "¿Qué estás vendiendo?", type: "text", required: true, placeholder: "Ej: Smart Ring Yawell R09 Bluetooth Control Gestual" },
      { name: "plataforma", label: "¿Dónde lo vas a publicar?", type: "select", required: true, options: ["MercadoLibre", "Instagram / Facebook", "Marketplace"] },
      { name: "condicion", label: "Condición", type: "select", required: true, options: ["Nuevo", "Usado", "Reacondicionado"] },
      { name: "marca", label: "Marca y modelo", type: "text", placeholder: "Ej: Yawell R09" },
      { name: "categoria", label: "Categoría", type: "text", placeholder: "Ej: Electrónica, Indumentaria, Hogar…" },
      {
        name: "keyword",
        label: "¿Cómo lo buscaría tu comprador?",
        type: "text",
        placeholder: "Ej: anillo inteligente bluetooth",
        help: "La frase exacta que tipearía en el buscador. Si no la sabés, la inferimos por vos.",
      },
      {
        name: "caracteristicas",
        label: "Características y especificaciones",
        type: "textarea",
        required: true,
        placeholder: "Marca, modelo, materiales, medidas, colores, lo que incluye la caja…\nCuantos más datos, mejor el resultado.",
        help: "Si usaste el link de arriba, revisá que los datos sean correctos antes de generar.",
      },
      { name: "envio", label: "Envío", type: "select", options: ["Envío gratis", "Envío con costo", "Prefiero no mencionarlo"] },
      { name: "cuotas", label: "Cuotas", type: "select", options: ["Ofrezco cuotas sin interés", "Cuotas con interés", "Prefiero no mencionarlo"] },
      { name: "garantia", label: "Garantía", type: "text", placeholder: "Ej: 12 meses contra defectos de fábrica (opcional)" },
    ],
  },
  {
    slug: "resenas",
    name: "Respondedor de reseñas",
    tagline: "Contestá reseñas con la voz de tu marca.",
    description:
      "Pegá una reseña de Google, MercadoLibre o TripAdvisor y obtené una respuesta profesional acorde al puntaje.",
    icon: "Star",
    image: "https://images.unsplash.com/photo-1633613286991-611fe299c4be",
    category: "Atención al cliente",
    accent: "from-amber-400 to-orange-500",
    output: "text",
    cta: "Generar respuesta",
    fields: [
      { name: "negocio", label: "Nombre de tu negocio", type: "text", required: true, placeholder: "Ej: Café Martínez Palermo" },
      { name: "resena", label: "Reseña del cliente", type: "textarea", required: true, placeholder: "Pegá acá la reseña tal cual la dejó el cliente." },
      { name: "rating", label: "Puntaje", type: "select", required: true, options: ["5 estrellas", "4 estrellas", "3 estrellas", "2 estrellas", "1 estrella"] },
      { name: "tono", label: "Tono de la marca", type: "select", options: ["Cercano", "Formal", "Divertido"] },
    ],
  },
  {
    slug: "cobranza",
    name: "Emails de cobranza",
    tagline: "Reclamá pagos sin perder al cliente.",
    description:
      "Generá un email de cobranza con el tono justo según los días de atraso: desde el recordatorio amable hasta el aviso pre-legal.",
    icon: "Mail",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f",
    category: "Finanzas",
    accent: "from-rose-400 to-red-500",
    output: "text",
    cta: "Generar email",
    fields: [
      { name: "cliente", label: "Cliente que adeuda", type: "text", required: true, placeholder: "Ej: Distribuidora El Sol S.A." },
      { name: "monto", label: "Monto adeudado", type: "text", required: true, placeholder: "Ej: $150.000 ARS" },
      { name: "dias", label: "Días de atraso", type: "number", required: true, placeholder: "Ej: 30" },
      { name: "tono", label: "Etapa", type: "select", required: true, options: ["Amable (primer aviso)", "Firme (segundo aviso)", "Pre-legal (último aviso)"] },
      { name: "contexto", label: "Contexto extra", type: "textarea", placeholder: "Qué se le vendió, acuerdos previos, fecha de la factura… (opcional)" },
    ],
  },
  {
    slug: "presupuestos",
    name: "Presupuestos y cotizaciones",
    tagline: "Un presupuesto profesional en PDF, en segundos.",
    description:
      "Cargá los ítems y obtené un presupuesto formal, prolijo y listo para enviar a tu cliente en PDF.",
    icon: "FileText",
    image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85",
    category: "Administración",
    accent: "from-indigo-400 to-blue-500",
    output: "pdf",
    cta: "Generar presupuesto",
    fields: [
      { name: "negocio", label: "Tu negocio (o tu nombre)", type: "text", required: true, placeholder: "Ej: Estudio Pérez Diseño" },
      { name: "cliente", label: "Cliente", type: "text", required: true, placeholder: "Ej: Panadería La Espiga" },
      {
        name: "trabajo",
        label: "Detalle del trabajo / ítems",
        type: "textarea",
        required: true,
        placeholder: "Un ítem por línea con su precio. Ej:\nDiseño de logo - 80000\nManual de marca - 120000",
        help: "Poné un ítem por línea. Si incluís precios, calculo el total.",
      },
      { name: "moneda", label: "Moneda", type: "select", required: true, options: ["ARS", "USD", "MXN", "CLP", "COP", "UYU", "PEN", "BOB", "PYG"] },
      { name: "condiciones", label: "Condiciones", type: "textarea", placeholder: "Validez de la oferta, forma de pago, plazos de entrega… (opcional)" },
    ],
  },
  {
    slug: "legales",
    name: "Documentos legales",
    tagline: "Contratos, NDA y políticas para tu país.",
    description:
      "Generá un borrador de documento legal adaptado a tu país. Ideal como base — siempre revisalo con un profesional.",
    icon: "Scale",
    image: "https://images.unsplash.com/photo-1505664194779-8beaceb93744",
    category: "Legal",
    accent: "from-sky-400 to-cyan-500",
    output: "pdf",
    cta: "Generar documento",
    fields: [
      {
        name: "tipo",
        label: "Tipo de documento",
        type: "select",
        required: true,
        options: [
          "Contrato de prestación de servicios",
          "Acuerdo de confidencialidad (NDA)",
          "Términos y condiciones",
          "Política de privacidad",
          "Política de devoluciones",
        ],
      },
      { name: "pais", label: "País", type: "select", required: true, options: ["Argentina", "México", "Colombia", "Chile", "Perú", "Uruguay"] },
      { name: "parte_a", label: "Parte A (vos / tu empresa)", type: "text", required: true, placeholder: "Ej: Juan Pérez / Estudio Pérez SRL" },
      { name: "parte_b", label: "Parte B (la otra parte)", type: "text", placeholder: "Ej: Panadería La Espiga (dejar vacío si es una política pública)" },
      { name: "detalle", label: "Detalle del acuerdo", type: "textarea", required: true, placeholder: "Objeto, plazo, montos, obligaciones, lo que aplique." },
    ],
  },
  // ── Bots nuevos ──────────────────────────────────────────────────────────
  {
    slug: "precios",
    name: "Optimizador de precios",
    tagline: "Precio justo, margen real, argumento de venta.",
    description:
      "Pegá los datos de tu producto y los de la competencia y obtené un precio sugerido con justificación y margen estimado.",
    icon: "TrendingUp",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f",
    category: "Ventas",
    accent: "from-violet-400 to-purple-500",
    output: "text",
    cta: "Optimizar precio",
    scrapeUrl: true,
    fields: [
      { name: "producto", label: "Tu producto", type: "text", required: true, placeholder: "Ej: Smart Ring Yawell R09" },
      { name: "costo", label: "Tu costo (precio de compra)", type: "text", required: true, placeholder: "Ej: $12.000 ARS o US$8" },
      { name: "moneda", label: "Moneda", type: "select", required: true, options: ["ARS", "USD", "MXN", "CLP", "COP", "UYU"] },
      { name: "competencia", label: "Precios de la competencia", type: "textarea", placeholder: "Copiá los precios de publicaciones similares. Ej:\nCompetidor A: $28.000\nCompetidor B: $31.500\nCompetidor C: $25.000" },
      { name: "diferencial", label: "¿Qué tiene de especial tu producto?", type: "textarea", placeholder: "Garantía, envío gratis, mejor calidad, stock inmediato… (opcional)" },
      { name: "margen_objetivo", label: "Margen objetivo (%)", type: "number", placeholder: "Ej: 40" },
    ],
  },
  {
    slug: "ficha-tecnica",
    name: "Ficha técnica de producto",
    tagline: "PDF prolijo con todas las specs para mandar a clientes.",
    description:
      "Pegá el link del producto o completá los datos y obtené una ficha técnica en PDF lista para compartir.",
    icon: "ClipboardList",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475",
    category: "Ventas",
    accent: "from-orange-400 to-amber-500",
    output: "pdf",
    cta: "Generar ficha técnica",
    scrapeUrl: true,
    fields: [
      { name: "producto", label: "Nombre del producto", type: "text", required: true, placeholder: "Ej: Smart Ring Yawell R09 Bluetooth" },
      { name: "marca", label: "Marca", type: "text", placeholder: "Ej: Yawell" },
      { name: "descripcion_corta", label: "Descripción breve", type: "textarea", placeholder: "1-2 oraciones describiendo para qué sirve." },
      {
        name: "especificaciones",
        label: "Especificaciones técnicas",
        type: "textarea",
        required: true,
        placeholder: "Una spec por línea. Ej:\nBluetooth 5.3\nImpermeable 5 ATM\nAutonomía 5-10 días\nCompatible iOS/Android",
        help: "Si usaste el link de arriba ya están completadas — revisalas.",
      },
      { name: "contenido_caja", label: "Contenido de la caja", type: "textarea", placeholder: "Ej: 1 anillo, 1 estuche de carga, cable USB-C, manual" },
      { name: "garantia", label: "Garantía", type: "text", placeholder: "Ej: 12 meses contra defectos de fábrica" },
    ],
  },
  {
    slug: "traduccion",
    name: "Traductor de publicaciones",
    tagline: "Tu publicación en portugués o inglés, lista para publicar.",
    description:
      "Traducí descripciones de MercadoLibre, Instagram o cualquier marketplace al portugués de Brasil o inglés, adaptado al mercado local.",
    icon: "Languages",
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa",
    category: "Ventas",
    accent: "from-pink-400 to-rose-500",
    output: "text",
    cta: "Traducir publicación",
    fields: [
      { name: "texto", label: "Publicación original (español)", type: "textarea", required: true, placeholder: "Pegá el título + descripción de tu publicación en español." },
      { name: "idioma_destino", label: "Idioma destino", type: "select", required: true, options: ["Portugués (Brasil)", "Inglés (EEUU)", "Inglés (Internacional)"] },
      { name: "plataforma", label: "Plataforma destino", type: "select", options: ["Mercado Livre Brasil", "Amazon", "Instagram", "AliExpress", "Etsy", "Otro marketplace"] },
      { name: "notas", label: "Notas de adaptación", type: "textarea", placeholder: "Medidas en pulgadas, moneda local, términos propios del mercado destino… (opcional)" },
    ],
  },
  {
    slug: "catalogo",
    name: "Catálogo de productos en PDF",
    tagline: "Un catálogo prolijo para mandar por WhatsApp.",
    description:
      "Listá tus productos con precios y descripciones y obtené un catálogo en PDF listo para compartir con clientes.",
    icon: "BookImage",
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8",
    category: "Ventas",
    accent: "from-cyan-400 to-teal-500",
    output: "pdf",
    cta: "Generar catálogo",
    fields: [
      { name: "negocio", label: "Nombre de tu negocio", type: "text", required: true, placeholder: "Ej: TechImport Argentina" },
      { name: "moneda", label: "Moneda", type: "select", required: true, options: ["ARS", "USD", "MXN", "CLP", "COP", "UYU"] },
      {
        name: "productos",
        label: "Productos",
        type: "textarea",
        required: true,
        placeholder: "Un producto por línea con precio y descripción breve. Ej:\nSmart Ring Yawell R09 - $28.000 - Bluetooth, 5 ATM, iOS/Android\nAuriculares TWS Pro - $15.500 - Cancelación de ruido, 30hs batería\nSmartwatch X200 - $42.000 - GPS, monitor cardíaco, AMOLED",
        help: "Formato libre — la IA organiza el catálogo.",
      },
      { name: "contacto", label: "Datos de contacto", type: "textarea", placeholder: "WhatsApp, email, Instagram… lo que quieras mostrar en el catálogo." },
      { name: "validez", label: "Validez de precios", type: "text", placeholder: "Ej: Precios válidos hasta el 30/06/2026" },
    ],
  },
];

export function getBot(slug: string): Bot | undefined {
  return BOTS.find((b) => b.slug === slug);
}
