import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_TEXT = 60_000; // ~20 páginas; evita PDFs gigantes que agoten CPU/memoria.

// Convierte texto plano en un PDF A4 simple, prolijo y con saltos de página.
export async function POST(req: NextRequest) {
  if (!(await rateLimit(getClientIp(req), "pdf", 20, 60))) {
    return NextResponse.json({ error: "Demasiadas solicitudes. Esperá un minuto." }, { status: 429 });
  }

  let body: { title?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const title = (body.title ?? "Documento").slice(0, 120);
  const text = (body.text ?? "").slice(0, MAX_TEXT);
  if (!text.trim()) {
    return NextResponse.json({ error: "Sin contenido" }, { status: 400 });
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const A4 = { w: 595.28, h: 841.89 };
  const margin = 56;
  const fontSize = 11;
  const lineHeight = 16;
  const maxWidth = A4.w - margin * 2;

  // pdf-lib no soporta caracteres fuera de WinAnsi; sanitizamos.
  const sanitize = (s: string) =>
    s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x00-\xFF]/g, "");

  const wrap = (line: string, f: typeof font, size: number): string[] => {
    const words = sanitize(line).split(/\s+/);
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > maxWidth && cur) {
        out.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) out.push(cur);
    return out.length ? out : [""];
  };

  let page = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - margin;

  // Título
  for (const l of wrap(title, fontBold, 18)) {
    page.drawText(l, { x: margin, y, size: 18, font: fontBold, color: rgb(0.1, 0.1, 0.12) });
    y -= 26;
  }
  y -= 8;

  const newPageIfNeeded = () => {
    if (y < margin + lineHeight) {
      page = pdf.addPage([A4.w, A4.h]);
      y = A4.h - margin;
    }
  };

  for (const raw of text.split("\n")) {
    if (raw.trim() === "") {
      y -= lineHeight * 0.6;
      newPageIfNeeded();
      continue;
    }
    for (const l of wrap(raw, font, fontSize)) {
      newPageIfNeeded();
      page.drawText(l, { x: margin, y, size: fontSize, font, color: rgb(0.15, 0.15, 0.17) });
      y -= lineHeight;
    }
  }

  // Pie
  const footer = "Generado con Pymela";
  page.drawText(footer, {
    x: margin,
    y: margin / 2,
    size: 8,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${title.replace(/[^a-zA-Z0-9-_ ]/g, "").slice(0, 60) || "documento"}.pdf"`,
    },
  });
}
