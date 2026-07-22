"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const EVENT = "ap-theme-change";

function current(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onMq = () => {
    if (!localStorage.getItem("ap-theme")) {
      document.documentElement.dataset.theme = mq.matches ? "dark" : "light";
      window.dispatchEvent(new Event(EVENT));
    }
  };
  mq.addEventListener("change", onMq);
  return () => {
    window.removeEventListener(EVENT, cb);
    mq.removeEventListener("change", onMq);
  };
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, current, () => "light");
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem("ap-theme", t);
  window.dispatchEvent(new Event(EVENT));
}

export function toggleTheme() {
  setTheme(current() === "dark" ? "light" : "dark");
}
