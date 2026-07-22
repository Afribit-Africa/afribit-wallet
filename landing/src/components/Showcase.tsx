"use client";

import { useState } from "react";
import { PhoneSim, type PhoneState } from "./PhoneSim";
import { SectionHead, SplitHeading, UnwindSection } from "./ui/Anim";
import { pressPulse } from "@/lib/anim";

const STEPS: {
  key: PhoneState;
  matches: PhoneState[];
  title: string;
  body: string;
}[] = [
  {
    key: "home",
    matches: ["home"],
    title: "Open",
    body: "Balance in sats and shillings. The scan button is the whole interface.",
  },
  {
    key: "scan",
    matches: ["scan"],
    title: "Scan",
    body: "Point it at a code. The wallet reads it before you can squint at it.",
  },
  {
    key: "detected",
    matches: ["detected"],
    title: "Detected",
    body: "Lightning invoice or M-Pesa till, recognised automatically. Flip the rail toggle and watch the same code change meaning.",
  },
  {
    key: "confirm",
    matches: ["confirm"],
    title: "Confirm",
    body: "Amount, fee, custody. Hold the button for one second, on purpose.",
  },
  {
    key: "success",
    matches: ["success"],
    title: "Settled",
    body: "The till gets shillings, the balance updates, the keys never left the phone.",
  },
];

declare global {
  interface Document {}
}

function jump(s: PhoneState) {
  const go = (document.documentElement as unknown as Record<string, unknown>)
    .__apPhoneGo as ((s: PhoneState) => void) | undefined;
  go?.(s);
}

export function Showcase() {
  const [active, setActive] = useState<PhoneState>("home");

  return (
    <UnwindSection id="product" className="mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-32">
      <SectionHead n="03" label="Try it yourself" />

      <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <SplitHeading
            text="Pay a till with sats. Right now."
            className="text-[clamp(2rem,4.4vw,3.3rem)] font-extrabold leading-[1.04] tracking-[-0.03em]"
          />
          <p data-uw className="mt-6 max-w-[30rem] text-[17px] leading-relaxed text-muted">
            This is not a video. Every screen is the real flow, wired up.
            Pay Mama Njeri&apos;s till, then try Send, Receive and Buy from
            the home screen. The balance remembers everything you do.
          </p>

          <div data-uw className="mt-10">
            {STEPS.map((s, i) => {
              const on = s.matches.includes(active);
              return (
                <button
                  key={s.key}
                  onClick={(e) => {
                    pressPulse(e.currentTarget);
                    jump(s.key);
                    setActive(s.key);
                  }}
                  className={`group grid w-full grid-cols-12 items-baseline gap-3 border-t border-line py-4 text-left transition-colors last:border-b ${
                    on ? "" : "opacity-60 hover:opacity-90"
                  }`}
                  aria-current={on ? "step" : undefined}
                >
                  <span
                    className={`col-span-1 font-mono text-xs ${on ? "text-orange" : "text-stone"}`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="col-span-3 flex items-center gap-2.5 text-[16px] font-bold">
                    {s.title}
                    {on && <span className="size-[6px] bg-orange" aria-hidden />}
                  </span>
                  <span className="col-span-8 text-[13.5px] leading-relaxed text-muted">
                    {s.body}
                  </span>
                </button>
              );
            })}
          </div>

          <p data-uw className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-stone">
            Demo data · Confirmation and settlement screens designed in-system
          </p>
        </div>

        <div data-uw className="lg:col-span-6">
          <PhoneSim onState={setActive} />
          <div className="mt-5 flex items-center justify-center gap-4">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-stone">
              <span className="size-[6px] animate-pulse bg-orange" />
              Live demo
            </p>
            <button
              onClick={(e) => {
                pressPulse(e.currentTarget);
                jump("home");
                setActive("home");
              }}
              className="rounded-full border border-line px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted transition-colors hover:border-fg/40 hover:text-fg"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </UnwindSection>
  );
}
