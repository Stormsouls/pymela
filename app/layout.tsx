import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LoginBanner } from "@/components/LoginBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pymela · Herramientas de IA para tu negocio",
  description:
    "Presupuestos, descripciones de productos, respuestas a reseñas, cobranzas y documentos legales para PyMEs y emprendedores de Latinoamérica. Sin saber nada de IA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LoginBanner />
        {children}
      </body>
    </html>
  );
}
