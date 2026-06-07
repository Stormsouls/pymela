import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Bot } from "@/lib/bots";
import { BotIcon } from "./BotIcon";
import { cn } from "@/lib/utils";

export function BotCard({ bot }: { bot: Bot }) {
  return (
    <Link
      href={`/${bot.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-all duration-200 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-xl hover:shadow-zinc-200/70"
    >
      {/* Cover image */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={`${bot.image}?auto=format&fit=crop&w=600&q=70`}
          alt={bot.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-zinc-600 backdrop-blur-sm">
          {bot.category}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-5 pb-5 pt-0">
        {/* Icon overlapping the image */}
        <span
          className={cn(
            "-mt-5 flex h-10 w-10 items-center justify-center rounded-xl shadow-md ring-2 ring-white",
            bot.accent
          )}
        >
          <BotIcon name={bot.icon} className="h-5 w-5" strokeWidth={1.75} />
        </span>

        <h3 className="mt-3 font-semibold leading-snug text-zinc-900">{bot.name}</h3>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-zinc-500">{bot.tagline}</p>

        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900 transition-all group-hover:gap-2.5">
          Probar gratis
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
