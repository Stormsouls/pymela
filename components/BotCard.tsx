import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Bot } from "@/lib/bots";
import { BotIcon } from "./BotIcon";
import { cn } from "@/lib/utils";

export function BotCard({ bot }: { bot: Bot }) {
  return (
    <Link
      href={`/${bot.slug}`}
      className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-200/50"
    >
      <div className="flex items-start justify-between">
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", bot.accent)}>
          <BotIcon name={bot.icon} className="h-5 w-5" strokeWidth={2} />
        </span>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
          {bot.category}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-zinc-900">{bot.name}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-zinc-500">{bot.tagline}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900">
        Probar gratis
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
