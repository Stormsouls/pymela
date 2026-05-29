import { notFound } from "next/navigation";
import { BOTS, getBot } from "@/lib/bots";
import { BotForm } from "@/components/BotForm";

export function generateStaticParams() {
  return BOTS.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bot = getBot(slug);
  if (!bot) return { title: "Pymela" };
  return { title: `${bot.name} · Pymela`, description: bot.tagline };
}

export default async function BotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bot = getBot(slug);
  if (!bot) notFound();
  return (
    <main className="min-h-screen bg-zinc-50">
      <BotForm bot={bot} />
    </main>
  );
}
