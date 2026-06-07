"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import type { Bot } from "@/lib/bots";
import { BotIcon } from "./BotIcon";
import { cn } from "@/lib/utils";

export function BotCard({ bot, index = 0 }: { bot: Bot; index?: number }) {
  const ref = useRef<HTMLAnchorElement>(null);

  function handleMove(e: React.MouseEvent<HTMLAnchorElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const max = 9; // grados
    el.style.setProperty("--rx", `${(px - 0.5) * max * 2}deg`);
    el.style.setProperty("--ry", `${(0.5 - py) * max * 2}deg`);
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
  }

  function handleLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <Link
      ref={ref}
      href={`/${bot.slug}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ animationDelay: `${index * 70}ms` }}
      className="group tilt-card animate-fade-up relative flex flex-col overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm hover:shadow-2xl hover:shadow-indigo-300/30"
    >
      {/* Gradient border glow on hover */}
      <div className="pointer-events-none absolute -inset-px z-0 rounded-3xl bg-gradient-to-br from-indigo-500/0 via-purple-500/0 to-pink-500/0 opacity-0 transition-opacity duration-500 group-hover:from-indigo-500/20 group-hover:via-purple-500/20 group-hover:to-pink-500/20 group-hover:opacity-100" />

      {/* Cover image */}
      <div className="relative z-10 h-44 overflow-hidden">
        <img
          src={`${bot.image}?auto=format&fit=crop&w=700&q=75`}
          alt={bot.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
        <span className="glass absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold text-zinc-700 shadow-sm">
          {bot.category}
        </span>
      </div>

      {/* Body */}
      <div className="relative z-10 flex flex-1 flex-col px-5 pb-5 pt-0">
        <span
          className={cn(
            "lift-z -mt-6 flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg ring-4 ring-white transition-transform duration-300 group-hover:scale-110",
            bot.accent
          )}
        >
          <BotIcon name={bot.icon} className="h-6 w-6" strokeWidth={1.75} />
        </span>

        <h3 className="lift-z-sm mt-3 font-semibold leading-snug text-zinc-900">{bot.name}</h3>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-zinc-500">{bot.tagline}</p>

        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 transition-all group-hover:gap-2.5">
          Probar gratis
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>

      {/* Glare following cursor */}
      <div className="tilt-glare pointer-events-none absolute inset-0 z-20 rounded-3xl" />
    </Link>
  );
}
