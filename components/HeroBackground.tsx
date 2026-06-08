"use client";

import { useEffect, useRef } from "react";
import { AnimatedBackground } from "./AnimatedBackground";

export function HeroBackground() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let mx = 0, my = 0, sy = 0;
    let raf = 0;

    function apply() {
      if (!el) return;
      el.querySelectorAll<HTMLElement>("[data-depth]").forEach((node) => {
        const d = parseFloat(node.dataset.depth || "0");
        const rot = node.dataset.rot || "0deg";
        const tx = mx * d * 60;
        // scroll parallax MUY agresivo + funciona en mobile (no depende del mouse)
        const ty = my * d * 60 - sy * d * 0.55;
        node.style.transform = `translate3d(${tx}px, ${ty}px, 0) rotate(${rot})`;
      });
      raf = 0;
    }
    function schedule() {
      if (!raf) raf = requestAnimationFrame(apply);
    }

    function onMove(e: MouseEvent) {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
      schedule();
    }
    function onScroll() {
      sy = window.scrollY;
      schedule();
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("scroll", onScroll, { passive: true });
    sy = window.scrollY;
    schedule();
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={root} className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900" />

      {/* Blobs con parallax (depth alto = se mueven más) */}
      <div data-depth="1.0" className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl animate-blob" />
      <div data-depth="0.7" className="absolute right-0 top-10 h-96 w-96 rounded-full bg-purple-600/30 blur-3xl animate-blob delay-200" />
      <div data-depth="1.3" className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-fuchsia-600/20 blur-3xl animate-blob delay-500" />

      {/* Constelación */}
      <AnimatedBackground />

      {/* Formas flotantes decorativas (parallax + float) */}
      <div data-depth="2.2" data-rot="12deg" className="absolute left-[12%] top-[22%] h-16 w-16 rounded-2xl border border-indigo-400/30 animate-float" style={{ transform: "rotate(12deg)" }} />
      <div data-depth="1.8" className="absolute right-[14%] top-[30%] h-10 w-10 rounded-full border-2 border-fuchsia-400/30 animate-float delay-300" />
      <div data-depth="2.6" className="absolute right-[24%] bottom-[26%] h-6 w-6 rounded-full bg-purple-400/40 animate-float delay-200" />
      <div data-depth="1.5" className="absolute left-[20%] bottom-[20%] h-3 w-3 rounded-full bg-indigo-300/60 animate-float" />
      <div data-depth="3.0" className="absolute left-[44%] top-[14%] h-2 w-2 rounded-full bg-fuchsia-300/70 animate-float delay-500" />

      {/* Funde hacia el zinc-50 de las cards */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-zinc-50" />
    </div>
  );
}
