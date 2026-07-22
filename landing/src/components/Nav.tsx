"use client";

import { useEffect, useRef } from "react";
import { animate, utils } from "animejs";
import { spinToggle } from "@/lib/anim";
import { toggleTheme, useTheme } from "@/lib/theme";

const links = [
  { href: "#problem", label: "The problem" },
  { href: "#tour", label: "Product" },
  { href: "#product", label: "Try it" },
  { href: "#custody", label: "Self custody" },
  { href: "#kibera", label: "Kibera" },
];

function ThemeToggle() {
  const theme = useTheme();
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={btn}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        if (btn.current) spinToggle(btn.current.firstElementChild!);
        toggleTheme();
      }}
      className="flex size-9 items-center justify-center rounded-full border border-line text-fg transition-colors hover:border-fg/40"
    >
      <span className="flex items-center justify-center" aria-hidden>
        {theme === "dark" ? (
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <circle cx="7.5" cy="7.5" r="3.4" fill="currentColor" stroke="none" />
            <path d="M7.5 0.8 v1.8 M7.5 12.4 v1.8 M0.8 7.5 h1.8 M12.4 7.5 h1.8 M2.8 2.8 l1.3 1.3 M10.9 10.9 l1.3 1.3 M12.2 2.8 l-1.3 1.3 M4.1 10.9 l-1.3 1.3" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M12.6 8.9 A6 6 0 1 1 5.1 1.4 A5 5 0 0 0 12.6 8.9 Z" />
          </svg>
        )}
      </span>
    </button>
  );
}

export function Nav() {
  const ref = useRef<HTMLElement>(null);
  const theme = useTheme();
  const suffix = theme === "dark" ? "-white" : "";

  useEffect(() => {
    if (!ref.current) return;
    utils.set(ref.current, { translateY: -22, opacity: 0 });
    animate(ref.current, {
      translateY: 0,
      opacity: 1,
      duration: 620,
      delay: 150,
      ease: "outExpo",
    });
  }, []);

  return (
    <header
      ref={ref}
      className="fixed inset-x-0 top-0 z-50 border-b border-line bg-bg/80 backdrop-blur-md"
      style={{ opacity: 0 }}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
        <a href="#top" className="flex items-center gap-2.5" aria-label="Afribit Pay, back to top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/brand/afribit-monogram${suffix}.svg`} alt="" className="h-[22px] w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/brand/afribit-wordmark${suffix}.svg`}
            alt="Afribit Pay"
            className="h-[15px] w-auto"
          />
        </a>
        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="nav-link relative font-mono text-[11px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-fg"
            >
              {l.label}
              <span className="nav-underline absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-orange transition-transform duration-300 ease-out" />
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href="#early-access"
            className="group inline-flex items-center gap-2 rounded-full bg-fg px-4 py-2 text-[13px] font-semibold text-bg transition-colors"
          >
            Get early access
            <span className="inline-block size-[6px] bg-orange transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </nav>
    </header>
  );
}
