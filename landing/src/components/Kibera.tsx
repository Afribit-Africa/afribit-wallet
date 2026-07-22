"use client";

import { SectionHead, SplitHeading, UnwindSection } from "./ui/Anim";

/* Photography slots are deliberately labelled as pending. The brief
   forbids stock imagery and no photography exists in the repo yet. */
const FRAMES = [
  {
    ratio: "aspect-[3/4]",
    caption: "Merchant portrait · Toi Market",
    span: "sm:col-span-5",
  },
  {
    ratio: "aspect-[4/3]",
    caption: "Onboarding session · Olympic, Kibera",
    span: "sm:col-span-7",
  },
  {
    ratio: "aspect-[16/9]",
    caption: "Sats settlement at a duka counter",
    span: "sm:col-span-12",
  },
];

export function Kibera() {
  return (
    <UnwindSection id="kibera" className="mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-32">
      <SectionHead n="05" label="Rooted in Kibera" />

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SplitHeading
            text="Built where it gets used."
            className="text-[clamp(2rem,4.4vw,3.3rem)] font-extrabold leading-[1.04] tracking-[-0.03em]"
          />
          <div className="mt-7 space-y-5 text-[17px] leading-relaxed text-muted">
            <p data-uw>
              Afribit did not arrive in Kibera with an app. It arrived with
              classes, market days and patient conversations, onboarding
              merchants and paying sats for real work long before this
              product had a name.
            </p>
            <p data-uw>
              Afribit Pay is that experience, folded into software. Every
              screen answers a question someone actually asked at a stall,
              in a chama meeting, or over mandazi and chai.
            </p>
          </div>
          <p data-uw className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-stone">
            Photography from the community is being gathered now
          </p>
        </div>

        <div className="lg:col-span-7">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
            {FRAMES.map((f, i) => (
              <div key={i} data-uw className={f.span}>
                <figure
                  className={`${f.ratio} relative flex w-full items-end overflow-hidden rounded-2xl border border-line bg-card2`}
                >
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(168,163,154,0.28),transparent_60%)]"
                  />
                  <div className="absolute left-4 top-4 size-[8px] bg-orange" aria-hidden />
                  <figcaption className="relative w-full p-4">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                      Photograph to come
                    </span>
                    <span className="mt-1 block text-[13px] font-semibold text-muted">
                      {f.caption}
                    </span>
                  </figcaption>
                </figure>
              </div>
            ))}
          </div>
        </div>
      </div>
    </UnwindSection>
  );
}
