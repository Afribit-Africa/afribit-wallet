"use client";

/* One scroll engine for the whole page: anime.js ScrollObserver.
   Motion remains only inside the phone simulator for state-driven
   (never scroll-driven) screen transitions, so the two never fight. */

import {
  animate,
  onScroll,
  splitText,
  stagger,
  utils,
  waapi,
} from "animejs";

export const reduced = () =>
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Hero and section titles: character drop-in with a bounce settle,
   the splitText + stagger + keyframed animate pattern from the brief. */
export function splitIn(el: HTMLElement, opts?: { delay?: number; staggerMs?: number }) {
  if (reduced()) {
    el.style.opacity = "1";
    return;
  }
  const { chars } = splitText(el, {
    chars: { class: "split-char" },
    words: { wrap: "clip" },
  });
  el.style.opacity = "1";
  utils.set(chars, { translateY: "1.05em", opacity: 0 });
  animate(chars, {
    translateY: [
      { to: "-0.14em", ease: "outExpo", duration: 480 },
      { to: 0, ease: "outBounce", duration: 520 },
    ],
    opacity: { to: 1, ease: "outQuad", duration: 220 },
    delay: stagger(opts?.staggerMs ?? 34, { start: opts?.delay ?? 0 }),
  });
}

/* Attach a one-shot scroll trigger. Fires cb the first time the
   element scrolls into view (or immediately if reduced motion). */
export function onEnterOnce(el: HTMLElement, cb: () => void) {
  if (reduced()) {
    cb();
    return;
  }
  let fired = false;
  animate(el, {
    duration: 1,
    autoplay: onScroll({
      target: el,
      enter: "bottom-=8% top",
      onEnterForward: () => {
        if (fired) return;
        fired = true;
        cb();
      },
    }),
  });
}

/* Section unwind: children marked data-uw rise in with one shared
   direction and easing so the page reads as a single system. */
export function unwind(sectionEl: HTMLElement) {
  const items = Array.from(
    sectionEl.querySelectorAll<HTMLElement>("[data-uw]"),
  );
  if (!items.length) return;
  if (reduced()) {
    items.forEach((el) => (el.style.opacity = "1"));
    return;
  }
  utils.set(items, { opacity: 0, translateY: 26 });
  onEnterOnce(sectionEl, () => {
    animate(items, {
      opacity: { to: 1, duration: 480, ease: "outQuad" },
      translateY: { to: 0, duration: 720, ease: "outExpo" },
      delay: stagger(85),
    });
  });
}

/* Small frequently-fired moments use waapi.animate: cheap and
   hardware accelerated. */
export function pressPulse(el: Element) {
  waapi.animate(el as HTMLElement, {
    scale: [1, 0.965, 1],
    duration: 260,
    ease: "out(3)",
  });
}

export function hoverNudge(el: Element, on: boolean) {
  waapi.animate(el as HTMLElement, {
    translate: on ? "0.25rem 0" : "0 0",
    duration: 320,
    ease: "out(4)",
  });
}

export function spinToggle(el: Element) {
  waapi.animate(el as HTMLElement, {
    rotate: "360deg",
    scale: [1, 0.82, 1],
    duration: 480,
    ease: "inOut(2)",
  });
}
