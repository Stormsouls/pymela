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
  category: string;
  accent: string; // clase tailwind para el acento de color
  output: BotOutput;
  cta: string;
  fields: BotField[];
};

export const BOTS: Bot[] = [
  {
    slug: "descripciones",
    name: "Descripciones para MercadoLibre",
    tagline: "Título SEO + descripción que vende, en segundos.",
    description:
      "Convertí los datos de tu producto en un título optimizado, bullets y una descripción persuasiva lista para publicar.",
    icon: "ShoppingBag",
    category: "Ventas",
    accent: "text-emerald-600 bg-emerald-50",
    output: "text",
    cta: "Generar descripción",
    fields: [
      { name: "producto", label: "¿Qué estás vendiendo?", type: "text", required: true, placeholder: "Ej: Zapatillas Nike Air Max 90" },
      { name: "categoria", label: "Categoría", type: "text", placeholder: "Ej: Indumentaria deportiva" },
      { name: "condicion", label: "Condición", type: "select", required: true, options: ["Nuevo", "Usado", "Reacondicionado"] },
      {
        name: "caracteristicas",
        label: "Características clave",
        type: "textarea",
        required: true,
        placeholder: "Marca, modelo, talle, color, material, medidas… lo que tengas.",
        help: "Cuantos más datos, mejor el resultado.",
      },
      { name: "plataforma", label: "¿Dónde lo vas a publicar?", type: "select", required: true, options: ["MercadoLibre", "Instagram / Facebook", "Marketplace"] },
    ],
  },
  {
    slug: "resenas",
    name: "Respondedor de reseñas",
    tagline: "Contestá reseñas con la voz de tu marca.",
    description:
      "Pegá una reseña de Google, MercadoLibre o TripAdvisor y obtené una respuesta profesional acorde al puntaje.",
    icon: "Star",
    category: "Atención al cliente",
    accent: "text-amber-600 bg-amber-50",
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
    category: "Finanzas",
    accent: "text-rose-600 bg-rose-50",
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
    category: "Administración",
    accent: "text-indigo-600 bg-indigo-50",
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
    category: "Legal",
    accent: "text-sky-600 bg-sky-50",
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
];

export function getBot(slug: string): Bot | undefined {
  return BOTS.find((b) => b.slug === slug);
}
