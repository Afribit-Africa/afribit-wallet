"use client";

/* The product, in motion: a pinned 3D stage. Each wallet screen zooms
   in from depth, holds centre stage while its micro-interactions play,
   then flies past the camera as the next one rises. Scroll position
   drives everything (scrub, not autoplay), so the visitor sets the
   pace. Below lg or with reduced motion it degrades to a plain
   stacked gallery of the same screens. */

import { useEffect, useRef, useState } from "react";
import { TourScreen, type TourKind } from "./PhoneSim";
import { SectionHead, SplitHeading } from "./ui/Anim";
import { reduced } from "@/lib/anim";

const CHAPTERS: {
  kind: TourKind;
  n: string;
  title: string;
  body: string;
}[] = [
  {
    kind: "home",
    n: "01",
    title: "Your money, at a glance",
    body: "Sats and shillings in one balance. The scan button is the whole interface.",
  },
  {
    kind: "scan",
    n: "02",
    title: "Point at any code",
    body: "The camera is the keyboard. No tabs, no modes, no ceremony.",
  },
  {
    kind: "detected",
    n: "03",
    title: "It knows what it saw",
    body: "Lightning invoice or M-Pesa till, recognised automatically and named in plain words.",
  },
  {
    kind: "confirm",
    n: "04",
    title: "Deliberate by design",
    body: "Amount, fee, custody, then hold for one second. No accidental payments.",
  },
  {
    kind: "success",
    n: "05",
    title: "Settled in seconds",
    body: "The till gets shillings. The keys never leave your phone.",
  },
  {
    kind: "send",
    n: "06",
    title: "Send to a person",
    body: "A phone number or a Lightning address, typed into the same box.",
  },
  {
    kind: "receive",
    n: "07",
    title: "Your address is your till",
    body: "One QR anyone can read, one address anyone can pay.",
  },
  {
    kind: "buy",
    n: "08",
    title: "Top up with M-Pesa",
    body: "KES in, sats out, straight to your keys. No exchange account.",
  },
];

const HOLD = 0.55; // fraction of a chapter spent at centre stage
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function ProductTour() {
  const track = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [flat, setFlat] = useState(false);
  const activeRef = useRef(0);

  useEffect(() => {
    setFlat(reduced() || window.innerWidth < 1024);
  }, []);

  useEffect(() => {
    if (flat) return;
    const N = CHAPTERS.length;
    let raf = 0;

    const seek = () => {
      raf = 0;
      const el = track.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = clamp(-r.top / total, 0, 0.9999);
      const f = p * N;

      const ai = clamp(Math.floor(f + 0.4), 0, N - 1);
      if (ai !== activeRef.current) {
        activeRef.current = ai;
        setActive(ai);
      }

      for (let i = 0; i < N; i++) {
        const card = cards.current[i];
        if (!card) continue;
        const local = f - i; // <0 waiting · 0..HOLD on stage · HOLD..1 exiting
        let scale = 0.62,
          y = 30,
          z = 0,
          rx = 12,
          ry = i % 2 ? -10 : 10,
          o = 0;
        if (local >= -1 && local < 0) {
          const t = 1 + local; // 0 → 1 approaching
          const e = 1 - Math.pow(1 - t, 3);
          scale = 0.62 + 0.38 * e;
          y = 30 - 30 * e;
          rx = 12 - 12 * e;
          ry = (i % 2 ? -10 : 10) * (1 - e);
          o = Math.pow(t, 1.4);
        } else if (local >= 0 && local <= HOLD) {
          const t = local / HOLD;
          scale = 1 + 0.045 * t; // slow push-in while on stage
          y = 0;
          rx = 0;
          ry = 0;
          o = 1;
        } else if (local > HOLD && local <= 1.35) {
          const t = clamp((local - HOLD) / (1 - HOLD), 0, 1.2);
          scale = 1.045 + 0.5 * t; // fly past the camera
          y = -14 * t;
          rx = -7 * t;
          o = clamp(1 - t * 1.35, 0, 1);
          z = 120 * t;
        }
        card.style.opacity = String(o);
        card.style.transform = `translate(-50%, -50%) translate3d(0, ${y}vh, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`;
        card.style.pointerEvents = "none";
        card.style.zIndex = String(100 + Math.round((1 - Math.abs(local - HOLD / 2)) * 10));
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(seek);
    };
    seek();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [flat]);

  const cap = CHAPTERS[active];

  return (
    <section id="tour" className="relative">
      <div className="mx-auto max-w-6xl px-5 pt-24 md:px-8 md:pt-32">
        <SectionHead n="02" label="The product" />
        <SplitHeading
          text="Every screen, in motion."
          className="max-w-3xl text-[clamp(2rem,4.4vw,3.3rem)] font-extrabold leading-[1.04] tracking-[-0.03em]"
        />
        <p data-uw className="mt-5 max-w-[32rem] text-[17px] leading-relaxed text-muted">
          Eight screens, one wallet. Scroll and each one steps up to
          the camera.
        </p>
      </div>

      {flat ? (
        /* calm fallback: stacked gallery */
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-14 px-5 py-16 sm:grid-cols-2 md:px-8">
          {CHAPTERS.map((c) => (
            <figure key={c.kind} className="flex flex-col items-center">
              <div className="pointer-events-none w-[240px] overflow-hidden rounded-[36px] bg-[#0c0b0a] p-[8px] shadow-[0_24px_60px_-24px_rgba(23,23,19,0.5)] ring-1 ring-white/10">
                <div className="relative h-[480px] overflow-hidden rounded-[28px] bg-[#141311]">
                  <TourScreen kind={c.kind} />
                </div>
              </div>
              <figcaption className="mt-5 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-copper">
                  {c.n}
                </p>
                <p className="mt-1 text-lg font-bold">{c.title}</p>
                <p className="mx-auto mt-1 max-w-[24rem] text-[14px] leading-relaxed text-muted">
                  {c.body}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div ref={track} style={{ height: `${CHAPTERS.length * 108}vh` }}>
          <div className="sticky top-0 h-screen overflow-hidden">
            {/* stage ambience */}
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_50%_46%,rgba(238,144,28,0.09),transparent_70%)]"
            />
            <div
              className="absolute inset-0"
              style={{ perspective: "1500px", perspectiveOrigin: "50% 42%" }}
            >
              {CHAPTERS.map((c, i) => (
                <div
                  key={c.kind}
                  ref={(el) => {
                    cards.current[i] = el;
                  }}
                  className="absolute left-1/2 top-[44%] will-change-transform"
                  style={{ opacity: 0, transformStyle: "preserve-3d" }}
                >
                  <div className="w-[264px] overflow-hidden rounded-[40px] bg-[#0c0b0a] p-[9px] shadow-[0_44px_110px_-30px_rgba(23,23,19,0.65)] ring-1 ring-white/10">
                    <div className="relative h-[540px] overflow-hidden rounded-[31px] bg-[#141311]">
                      <TourScreen kind={c.kind} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* caption, synced to the active chapter */}
            <div className="absolute inset-x-0 bottom-8 flex justify-center px-5">
              <div key={active} className="tour-caption max-w-xl text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-copper">
                  {cap.n} · {String(CHAPTERS.length).padStart(2, "0")}
                </p>
                <p className="mt-1.5 text-xl font-extrabold tracking-[-0.02em]">
                  {cap.title}
                </p>
                <p className="mt-1 text-[14px] leading-relaxed text-muted">{cap.body}</p>
              </div>
            </div>

            {/* progress rail */}
            <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col gap-2.5 md:flex">
              {CHAPTERS.map((c, i) => (
                <span
                  key={c.kind}
                  className={`size-[7px] transition-colors duration-300 ${
                    i === active ? "bg-orange" : "bg-line"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
