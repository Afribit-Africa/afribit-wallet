"use client";

import { useRef } from "react";
import { waapi } from "animejs";
import { SectionHead, SplitHeading, UnwindSection } from "./ui/Anim";

const EMAIL = "eddie@afribit.africa";
const MAILTO = {
  waitlist: `mailto:${EMAIL}?subject=${encodeURIComponent("Afribit Pay · Early access")}&body=${encodeURIComponent("Hi Eddie,\n\nPut me on the Afribit Pay waitlist.\n\nName:\nWhere I am:\n")}`,
  partner: `mailto:${EMAIL}?subject=${encodeURIComponent("Afribit Pay · Partnership")}&body=${encodeURIComponent("Hi Eddie,\n\nWe would like to talk about partnering on Afribit Pay.\n\nOrganisation:\n")}`,
};

/* The settle button: the brand's own gesture instead of a template
   effect. The settlement square sits beside the label; on hover it
   drops into place like a full stop landing, on press the whole
   button settles. waapi keeps these frequent moments cheap. */
export function SettleButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const sq = useRef<HTMLSpanElement>(null);
  return (
    <a
      href={href}
      onMouseEnter={() => {
        if (!sq.current) return;
        waapi.animate(sq.current, {
          translate: ["0 -0.55rem", "0 0"],
          scale: [0.6, 1],
          duration: 450,
          ease: "outBounce",
        });
      }}
      onMouseDown={(e) => {
        waapi.animate(e.currentTarget, {
          scale: [1, 0.96, 1],
          duration: 240,
          ease: "out(3)",
        });
      }}
      className={`group inline-flex items-center gap-3 rounded-full bg-orange px-7 py-4 text-[15px] font-bold text-ink transition-shadow hover:shadow-[0_10px_34px_-10px_rgba(238,144,28,0.65)] ${className}`}
    >
      {children}
      <span ref={sq} className="inline-block size-[8px] bg-ink" aria-hidden />
    </a>
  );
}

const PATHS = [
  {
    k: "Early access",
    title: "Use it first",
    body: "Join the pilot list for Kibera and be in the first group of wallets when the doors open.",
    action: "Join the list",
    href: MAILTO.waitlist,
    external: false,
  },
  {
    k: "Partners",
    title: "Build it with us",
    body: "Funders and organisations who want everyday Bitcoin to exist: we would like to talk.",
    action: "Partner with us",
    href: MAILTO.partner,
    external: false,
  },
  {
    k: "Progress",
    title: "Watch it happen",
    body: "Afribit has been on the ground in Kibera for years. The wallet is the next chapter.",
    action: "Visit afribit.africa",
    href: "https://afribit.africa/",
    external: true,
  },
];

export function CTA() {
  return (
    <UnwindSection id="early-access" className="mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-32">
      <SectionHead n="06" label="Be early" />

      <SplitHeading
        text="Everyday Bitcoin is almost here."
        className="max-w-3xl text-[clamp(2.2rem,5vw,3.8rem)] font-extrabold leading-[1.02] tracking-[-0.03em]"
      />
      <p data-uw className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted">
        Nothing to download yet, and that is the point. Get in before
        launch and help shape what ships.
      </p>

      <div data-uw className="mt-8">
        <SettleButton href={MAILTO.waitlist}>Join the waitlist</SettleButton>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-stone">
          Goes straight to {EMAIL}
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
        {PATHS.map((p) => (
          <div key={p.k} data-uw>
            <a
              href={p.href}
              target={p.external ? "_blank" : undefined}
              rel={p.external ? "noopener noreferrer" : undefined}
              className="group flex h-full flex-col justify-between rounded-2xl border border-line bg-card p-7 transition-colors hover:bg-ink hover:text-ivory dark:hover:bg-card2"
            >
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-copper group-hover:text-orange">
                  {p.k}
                </p>
                <p className="mt-3 text-2xl font-bold">{p.title}</p>
                <p className="mt-3 text-[15px] leading-relaxed text-muted group-hover:text-ivory/65">
                  {p.body}
                </p>
              </div>
              <span className="mt-8 inline-flex items-center gap-2.5 font-semibold">
                {p.action}
                <span className="inline-block size-[7px] bg-orange transition-transform group-hover:translate-x-1" />
              </span>
            </a>
          </div>
        ))}
      </div>
    </UnwindSection>
  );
}

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ink text-ivory">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/afribit-monogram-white.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-16 w-[520px] opacity-[0.06]"
      />
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8">
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-end">
          <div>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/afribit-monogram-white.svg" alt="" className="h-8 w-auto" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/afribit-wordmark-white.svg"
                alt="Afribit Pay"
                className="h-[22px] w-auto"
              />
            </div>
            <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.26em] text-stone">
              Everyday Bitcoin<span className="text-orange">.</span>
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <a
                href="https://afribit.africa/"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/55 transition-colors hover:text-ivory"
              >
                Powered by Afribit Africa
                <span className="inline-block size-[5px] bg-orange transition-transform group-hover:translate-x-0.5" />
              </a>
              <a
                href={`mailto:${EMAIL}`}
                className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/55 transition-colors hover:text-ivory"
              >
                {EMAIL}
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/45 md:text-right">
            <span>Pre-launch</span>
            <span>Built in Kibera, Nairobi</span>
            <span>© 2026 Afribit Pay</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
