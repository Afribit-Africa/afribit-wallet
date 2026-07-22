"use client";

import { SectionHead, SplitHeading, UnwindSection } from "./ui/Anim";

const TENETS = [
  {
    n: "A",
    title: "Keys live on your phone",
    body: "The wallet generates your keys on your device and they never leave it. Afribit Pay is an app, not an account.",
  },
  {
    n: "B",
    title: "We never touch your sats",
    body: "There is no company balance sheet holding customer coins. Nothing for us to freeze, lend out, or lose.",
  },
  {
    n: "C",
    title: "Walk away whenever",
    body: "Your twelve words restore your money in any standard wallet. Loyalty should be earned, not locked in.",
  },
];

/* Three real positions shown, the rest withheld. The point is the
   shape of self custody, not a usable phrase. */
const SEED = [
  "shilling", "······", "······", "······", "sunrise", "······",
  "······", "······", "······", "market", "······", "······",
];

export function Custody() {
  return (
    <section id="custody" className="bg-ink text-ivory">
      <UnwindSection
        as="div"
        className="mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-36"
      >
        <SectionHead n="04" label="Self custody" dark />

        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 className="text-[clamp(2.6rem,6vw,4.6rem)] font-extrabold leading-[1.0] tracking-[-0.035em]">
              <SplitHeading as="span" text="You hold" className="block" />
              <span className="block">
                <SplitHeading as="span" text="the keys" delay={180} />
                <span
                  data-uw
                  aria-hidden
                  className="ml-3 inline-block size-[0.16em] bg-orange"
                />
              </span>
            </h2>
            <p data-uw className="mt-8 max-w-[32rem] text-lg leading-relaxed text-ivory/65">
              Non-custodial is not a feature on a list. It is the whole
              deal. Money that answers to you alone, on a phone in your
              pocket, in a neighbourhood where trust is earned face to
              face.
            </p>

            <div className="mt-12">
              {TENETS.map((t) => (
                <div
                  key={t.n}
                  data-uw
                  className="grid grid-cols-12 items-baseline gap-4 border-t border-ivory/12 py-6"
                >
                  <span className="col-span-1 font-mono text-xs text-orange">
                    {t.n}
                  </span>
                  <p className="col-span-11 text-xl font-bold sm:col-span-4">
                    {t.title}
                  </p>
                  <p className="col-span-11 col-start-2 text-[15px] leading-relaxed text-ivory/60 sm:col-span-7 sm:col-start-6">
                    {t.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div data-uw className="rounded-2xl border border-ivory/12 bg-charcoal/60 p-7">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone">
                Your twelve words · not ours
              </p>
              <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                {SEED.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-baseline gap-2 border-b border-ivory/8 pb-2"
                  >
                    <span className="font-mono text-[10px] text-stone/70">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`font-mono text-[13px] ${
                        w === "······" ? "text-ivory/25" : "text-orange"
                      }`}
                    >
                      {w}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-[13px] leading-relaxed text-ivory/45">
                Written on paper, kept at home. If your phone drowns in the
                rains, your money does not.
              </p>
            </div>
          </div>
        </div>
      </UnwindSection>
    </section>
  );
}
