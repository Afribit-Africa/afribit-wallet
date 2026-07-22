"use client";

import { useEffect, useRef } from "react";
import { animate, stagger, utils } from "animejs";
import { splitIn, reduced } from "@/lib/anim";
import { PhoneSim } from "./PhoneSim";
import { HeroBackdrop } from "./HeroBackdrop";

export function Hero() {
  const line1 = useRef<HTMLSpanElement>(null);
  const line2 = useRef<HTMLSpanElement>(null);
  const rest = useRef<HTMLDivElement>(null);
  const phone = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLImageElement>(null);

  /* One-time narrative entrance: heavier keyframed animate() is the
     right tool here, waapi is reserved for the small repeat moments. */
  useEffect(() => {
    if (line1.current) splitIn(line1.current, { delay: 250 });
    if (line2.current) splitIn(line2.current, { delay: 520 });

    if (rest.current) {
      const items = Array.from(rest.current.querySelectorAll("[data-hero]"));
      if (reduced()) {
        items.forEach((el) => ((el as HTMLElement).style.opacity = "1"));
      } else {
        utils.set(items, { opacity: 0, translateY: 22 });
        animate(items, {
          opacity: { to: 1, duration: 420, ease: "outQuad" },
          translateY: { to: 0, duration: 680, ease: "outExpo" },
          delay: stagger(110, { start: 950 }),
        });
      }
    }
    if (phone.current) {
      if (!reduced()) {
        utils.set(phone.current, { opacity: 0, translateY: 90 });
        animate(phone.current, {
          opacity: { to: 1, duration: 500, ease: "outQuad" },
          translateY: { to: 0, duration: 900, ease: "outExpo" },
          delay: 620,
        });
      } else {
        phone.current.style.opacity = "1";
      }
    }
    /* the watermark drifts slowly, time-based, not scroll-based */
    if (mark.current && !reduced()) {
      animate(mark.current, {
        translateY: [-14, 14],
        duration: 9000,
        ease: "inOutSine",
        loop: true,
        alternate: true,
      });
    }
  }, []);

  return (
    <section id="top" className="relative overflow-hidden pt-16">
      <HeroBackdrop />

      {/* the monogram watermark, kept from v1 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={mark}
        src="/brand/afribit-monogram.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-10 w-[560px] opacity-[0.05] md:w-[760px] dark-mark"
      />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-5 pb-16 pt-14 md:px-8 lg:grid-cols-12 lg:gap-6 lg:pb-24 lg:pt-20">
        <div className="lg:col-span-7">
          <p
            data-hero
            className="inline-flex items-center gap-2.5 rounded-full border border-line px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.24em] text-muted"
          >
            <span className="size-[7px] bg-orange" />
            Everyday Bitcoin.
          </p>

          <h1
            className="mt-8 text-[clamp(2.8rem,6.8vw,5.2rem)] font-extrabold leading-[0.98] tracking-[-0.035em]"
            aria-label="Buy it. Hold it. Spend it like cash."
          >
            <span ref={line1} className="block" aria-hidden>
              Buy it. Hold it.
            </span>
            <span ref={line2} className="block" aria-hidden>
              Spend it like cash.
            </span>
          </h1>

          <div ref={rest}>
            <p
              data-hero
              className="mt-7 max-w-[34rem] text-lg leading-relaxed text-muted"
            >
              Afribit Pay is a non-custodial Bitcoin wallet that speaks
              M-Pesa. Buy sats with the money you already have, hold your own
              keys, and pay any till or Lightning invoice from one app.
            </p>

            <div data-hero className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href="#product"
                className="group inline-flex items-center gap-2.5 rounded-full bg-orange px-6 py-3.5 text-[15px] font-bold text-ink transition-transform hover:scale-[1.03] active:scale-[0.97]"
              >
                Try the wallet below
                <span className="inline-block size-[7px] bg-ink transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="#early-access"
                className="inline-flex items-center gap-2 rounded-full border border-line px-6 py-3.5 text-[15px] font-semibold text-muted transition-colors hover:border-fg/40 hover:text-fg"
              >
                Get early access
              </a>
            </div>

            <p
              data-hero
              className="mt-10 font-mono text-[11px] uppercase tracking-[0.2em] text-stone"
            >
              Pre-launch · Built in Kibera, Nairobi
            </p>
          </div>
        </div>

        {/* the actual product, live */}
        <div ref={phone} className="lg:col-span-5">
          <PhoneSim />
          <p className="mt-5 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-stone">
            <span className="size-[6px] animate-pulse bg-orange" />
            It is live. Tap the scan button.
          </p>
        </div>
      </div>
    </section>
  );
}

const ITEMS = [
  "Buy with M-Pesa",
  "Hold your keys",
  "Spend anywhere",
  "Settled in seconds",
];

export function Marquee() {
  const row = [...ITEMS, ...ITEMS, ...ITEMS];
  return (
    <div className="relative overflow-hidden border-y border-line bg-bg py-4">
      <div className="animate-marquee flex w-max items-center gap-8 whitespace-nowrap">
        {[0, 1].map((half) => (
          <div key={half} className="flex items-center gap-8" aria-hidden={half === 1}>
            {row.map((item, i) => (
              <span
                key={i}
                className="flex items-center gap-8 font-mono text-xs uppercase tracking-[0.28em] text-muted"
              >
                {item}
                <span className="inline-block size-[6px] bg-orange" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
