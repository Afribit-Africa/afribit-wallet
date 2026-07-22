"use client";

import {
  createElement,
  useEffect,
  useRef,
  type ElementType,
  type ReactNode,
} from "react";
import { onEnterOnce, splitIn, unwind } from "@/lib/anim";

/* Title that reveals character by character when scrolled into view. */
export function SplitHeading({
  as = "h2",
  text,
  className,
  delay = 0,
}: {
  as?: ElementType;
  text: string;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    onEnterOnce(el, () => splitIn(el, { delay, staggerMs: 20 }));
  }, [delay]);
  return createElement(
    as,
    { ref, className, style: { opacity: 0 }, "data-split": "", "aria-label": text },
    text,
  );
}

/* Section wrapper: everything inside marked data-uw unwinds in with
   the shared direction/easing when the section enters the viewport. */
export function UnwindSection({
  as = "section",
  children,
  className,
  id,
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current) unwind(ref.current);
  }, []);
  return createElement(as, { ref, className, id }, children);
}

/* Numbered section header, quoting the moodboard grid labels. */
export function SectionHead({
  n,
  label,
  dark = false,
}: {
  n: string;
  label: string;
  dark?: boolean;
}) {
  return (
    <div data-uw className="mb-12 md:mb-16">
      <div className="flex items-baseline gap-4">
        <span
          className={`font-mono text-xs tracking-[0.22em] ${dark ? "text-orange" : "text-copper"}`}
        >
          {n}
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.22em] text-stone">
          {label}
        </span>
        <span
          aria-hidden
          className="mb-[3px] ml-1 inline-block size-[7px] self-center bg-orange"
        />
      </div>
      <div className={`mt-4 h-px w-full ${dark ? "rule-light" : "rule"}`} />
    </div>
  );
}
