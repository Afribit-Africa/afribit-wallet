"use client";

/* Hyperspeed (React Bits, pulled via its shadcn registry) recolored
   to the brand so it reads as ours: near-black road, orange and
   copper light trails. Dark mode only, skipped entirely for
   reduced-motion users, lazy-loaded so light mode never pays for
   three.js. It renders its own WebGL canvas and never touches
   scroll, so it cannot fight the anime.js ScrollObserver system. */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme";
import { reduced } from "@/lib/anim";

const Hyperspeed = dynamic(() => import("./Hyperspeed"), { ssr: false });

const BRAND_OPTIONS = {
  distortion: "turbulentDistortion",
  length: 400,
  roadWidth: 10,
  islandWidth: 2,
  lanesPerRoad: 3,
  fov: 90,
  fovSpeedUp: 140,
  speedUp: 2,
  carLightsFade: 0.4,
  totalSideLightSticks: 18,
  lightPairsPerRoadWay: 36,
  colors: {
    roadColor: 0x0b0a09,
    islandColor: 0x0e0d0b,
    background: 0x0e0d0b,
    shoulderLines: 0x2a2620,
    brokenLines: 0x2a2620,
    leftCars: [0xee901c, 0xc97932, 0xf2b25a],
    rightCars: [0xee901c, 0x8a5220, 0xc97932],
    sticks: 0xee901c,
  },
};

export function HeroBackdrop() {
  const theme = useTheme();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setOk(!reduced());
  }, []);

  if (theme !== "dark" || !ok) return null;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <Hyperspeed effectOptions={BRAND_OPTIONS} />
      {/* keep the type readable over the trails */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0e0d0b]/92 via-[#0e0d0b]/62 to-[#0e0d0b]/30" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0e0d0b] to-transparent" />
    </div>
  );
}
