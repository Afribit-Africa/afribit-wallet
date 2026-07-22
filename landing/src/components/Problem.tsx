"use client";

import { SectionHead, SplitHeading, UnwindSection } from "./ui/Anim";

function AppCard({
  title,
  sub,
  tags,
}: {
  title: string;
  sub: string;
  tags: string[];
}) {
  return (
    <div data-uw className="rounded-2xl border border-line bg-card p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone">
        {sub}
      </p>
      <p className="mt-2 text-xl font-bold">{title}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((t) => (
          <span
            key={t}
            className="rounded-full border border-line px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Problem() {
  return (
    <UnwindSection id="problem" className="mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-32">
      <SectionHead n="01" label="The problem" />

      <div className="grid grid-cols-1 gap-14 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <SplitHeading
            text="Spending Bitcoin here still takes two apps."
            className="text-[clamp(2rem,4.4vw,3.3rem)] font-extrabold leading-[1.04] tracking-[-0.03em]"
          />
          <div className="mt-7 max-w-[30rem] space-y-5 text-[17px] leading-relaxed text-muted">
            <p data-uw>
              You buy sats in an exchange app. Then you cash out through a
              second app to actually pay for anything, because the duka, the
              matatu and the water point all run on M-Pesa.
            </p>
            <p data-uw>
              Two logins. Two balances. Fees on the way in, fees on the way
              out. And the whole time, your coins sit in someone else&apos;s
              custody, not yours.
            </p>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AppCard
              sub="App one"
              title="The exchange"
              tags={["KYC queue", "Custodial", "Withdrawal fee"]}
            />
            <AppCard
              sub="App two"
              title="The money app"
              tags={["Spendable", "No Bitcoin", "More fees"]}
            />
          </div>

          <div data-uw className="mx-auto my-2 h-10 w-px bg-line" aria-hidden />

          <div
            data-uw
            className="relative overflow-hidden rounded-2xl bg-ink p-7 text-ivory ring-1 ring-white/10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/afribit-monogram-white.svg"
              alt=""
              aria-hidden
              className="pointer-events-none absolute -right-6 -top-4 w-40 opacity-10"
            />
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-orange">
              Afribit Pay
            </p>
            <p className="mt-2 text-2xl font-bold">One app. Both rails.</p>
            <p className="mt-3 max-w-[26rem] text-[15px] leading-relaxed text-ivory/70">
              Buy with M-Pesa, hold your own keys, and pay Lightning or a
              till number from the same balance. The rail becomes a detail.
            </p>
          </div>
        </div>
      </div>
    </UnwindSection>
  );
}
