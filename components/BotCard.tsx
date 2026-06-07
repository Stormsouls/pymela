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
          className="h-full w-full object-cover blur-[2px] brightness-[.92] transition-all duration-700 ease-out group-hover:scale-110 group-hover:blur-0 group-hover:brightness-100"
        />
        {/* Degradé suave hacia el blanco del body — sin corte crudo */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white via-white/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />
        <span className="glass absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold text-zinc-700 shadow-sm">
          {bot.category}
        </span>
      </div>

      {/* Body */}
      <div className="relative z-10 flex flex-1 flex-col px-5 pb-5 pt-0">
        <span
          className={cn(
            "lift-z -mt-7 flex items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ring-4 ring-white transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3",
            bot.accent
          )}
          style={{ height: "3.25rem", width: "3.25rem" }}
        >
          <BotIcon name={bot.icon} className="h-6 w-6 drop-shadow" strokeWidth={2} />
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
