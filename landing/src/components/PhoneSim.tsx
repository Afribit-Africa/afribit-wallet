"use client";

/* The product, feelable: coded recreations of the real wallet mockups
   (Mocks/screenshots) wired into a tappable state machine. Home, scan,
   detected, confirm and settle mirror the payment story; send, receive
   and buy are live too. Uses the actual brand SVGs. Confirm and the
   success states have no PNG source; they are designed in-system.
   Motion here is state-driven only, never scroll. Demo rate keeps the
   mock's own math: 100 sats = 1 KES. */

import { AnimatePresence, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { animate, scrambleText } from "animejs";
import { pressPulse } from "@/lib/anim";

export type PhoneState =
  | "home"
  | "scan"
  | "detected"
  | "confirm"
  | "success"
  | "send"
  | "receive"
  | "buy";

type Rail = "mpesa" | "lightning";
type Flow =
  | { kind: "pay"; rail: Rail }
  | { kind: "send"; target: "mpesa" | "ln" }
  | { kind: "buy"; kes: number };

const EASE = [0.22, 1, 0.36, 1] as const;

const START_BAL = 125_500;
const PAY = {
  merchant: "Mama Njeri",
  place: "Toi Market",
  till: "832 445",
  kes: 250,
  sats: 25_000,
  fee: 4,
  invoice: "baraka@blink.sv",
};
const SEND = {
  phone: "+254 712 345 678",
  ln: "baraka@blink.sv",
  phoneKes: 200,
  phoneSats: 20_000,
  lnSats: 2_000,
  fee: 4,
};
const MY_ADDRESS = "wanjiku@blink.sv";

const fmt = (n: number) => n.toLocaleString("en-KE");

/* ---------- deterministic pseudo-QR ---------- */
function qrCells(seed: number, n = 21) {
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const inFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const cells: boolean[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) cells.push(!inFinder(r, c) && rnd() > 0.52);
  return cells;
}

function QR({ seed = 7, className }: { seed?: number; className?: string }) {
  const n = 21;
  const cells = useMemo(() => qrCells(seed, n), [seed]);
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" fill="#171713" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="#171713" />
    </g>
  );
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className={className} aria-hidden>
      <rect width={n} height={n} fill="#fff" />
      {cells.map((on, i) =>
        on ? (
          <rect key={i} x={i % n} y={Math.floor(i / n)} width="1" height="1" fill="#171713" />
        ) : null,
      )}
      {finder(0, 0)}
      {finder(n - 7, 0)}
      {finder(0, n - 7)}
    </svg>
  );
}

/* ---------- scrambling number ---------- */
function ScrambleNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || last.current === value) return;
    last.current = value;
    el.textContent = fmt(value);
    animate(el, {
      innerHTML: scrambleText({ chars: "0123456789", duration: 850 }),
      duration: 850,
      ease: "outQuad",
    });
  }, [value]);
  return (
    <span ref={ref} className={className}>
      {fmt(value)}
    </span>
  );
}

/* ---------- hold-to-pay ---------- */
function HoldToPay({ onDone, demo }: { onDone: () => void; demo?: boolean }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = () => {
    if (demo) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      setHolding(false);
      onDone();
    }, 950);
  };
  const stop = () => {
    setHolding(false);
    if (timer.current) clearTimeout(timer.current);
  };
  return (
    <button
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      className="relative w-full touch-none select-none overflow-hidden rounded-2xl bg-orange py-4 text-[15px] font-bold text-ink"
    >
      <motion.span
        className={`absolute inset-y-0 left-0 bg-ink/20 ${demo ? "demo-holdfill" : ""}`}
        initial={{ width: 0 }}
        animate={{ width: holding ? "100%" : 0 }}
        transition={
          holding
            ? { duration: 0.95, ease: "linear" }
            : { duration: 0.25, ease: "easeOut" }
        }
      />
      <span className="relative">{holding ? "Keep holding…" : "Hold to pay"}</span>
    </button>
  );
}

/* ---------- chrome ---------- */
function StatusBar({ light }: { light?: boolean }) {
  const c = light ? "#171713" : "#f7f5f2";
  return (
    <div
      className="flex items-center justify-between px-6 pt-3.5 text-[12px] font-semibold"
      style={{ color: c }}
    >
      <span>9:41</span>
      <span className="absolute left-1/2 top-2.5 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-black" />
      <span className="flex items-center gap-1.5" aria-hidden>
        <svg width="15" height="10" viewBox="0 0 15 10" fill={c}>
          <rect x="0" y="6" width="2.6" height="4" rx="0.6" />
          <rect x="4" y="4" width="2.6" height="6" rx="0.6" />
          <rect x="8" y="2" width="2.6" height="8" rx="0.6" />
          <rect x="12" y="0" width="2.6" height="10" rx="0.6" opacity="0.4" />
        </svg>
        <svg width="20" height="10" viewBox="0 0 20 10" aria-hidden>
          <rect x="0.5" y="0.5" width="16" height="9" rx="2.5" fill="none" stroke={c} strokeOpacity="0.5" />
          <rect x="2" y="2" width="11" height="6" rx="1.2" fill={c} />
          <rect x="17.5" y="3" width="2" height="4" rx="1" fill={c} opacity="0.5" />
        </svg>
      </span>
    </div>
  );
}

function AppHeader() {
  return (
    <div className="flex items-center justify-between px-6 pt-4">
      <span className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/afribit-monogram-white.svg" alt="" className="h-[15px] w-auto" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/afribit-wordmark-white.svg" alt="Afribit Pay" className="h-[13px] w-auto" />
      </span>
      <span className="flex size-8 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold text-ivory">
        W
      </span>
    </div>
  );
}

function LightHeader({
  title,
  onBack,
}: {
  title: string;
  onBack?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 pt-3">
      <button
        onClick={onBack}
        aria-label="Back"
        className="flex size-9 items-center justify-center rounded-full bg-ink/6 text-[15px]"
      >
        ‹
      </button>
      <span className="text-[17px] font-bold">{title}</span>
    </div>
  );
}

/* =========================================================
   SCREENS — each mirrors a mockup in Mocks/screenshots
   ========================================================= */

export function HomeScreen({
  balance = START_BAL,
  lastEvent = null,
  onScan,
  onSend,
  onReceive,
  onBuy,
}: {
  balance?: number;
  lastEvent?: { label: string; sats: string } | null;
  onScan?: () => void;
  onSend?: () => void;
  onReceive?: () => void;
  onBuy?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-[#141311] text-ivory">
      <StatusBar />
      <AppHeader />
      <div className="px-6 pt-8">
        <p className="text-[13px] text-stone">Total balance</p>
        <p className="mt-1 flex items-baseline gap-2">
          <ScrambleNumber
            value={balance}
            className="text-[36px] font-extrabold leading-none tracking-tight"
          />
          <span className="text-[15px] font-semibold text-stone">sats</span>
        </p>
        <p className="mt-2 text-[13px] text-stone">≈ KES {fmt(Math.round(balance / 100))}</p>
      </div>
      <div className="mt-7 flex items-start justify-center gap-7 px-6">
        <button onClick={onSend} className="flex flex-col items-center gap-2" aria-label="Send">
          <span className="flex size-12 items-center justify-center rounded-full bg-white/8 ring-1 ring-white/10">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#f7f5f2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12 L12 4 M12 4 H6 M12 4 V10" />
            </svg>
          </span>
          <span className="text-[12px] text-stone">Send</span>
        </button>
        <button
          onClick={(e) => {
            pressPulse(e.currentTarget);
            onScan?.();
          }}
          className="flex flex-col items-center gap-2"
          aria-label="Open the scanner"
        >
          <span className="animate-softpulse flex size-16 items-center justify-center rounded-full bg-orange">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#171713" strokeWidth="2.2" strokeLinecap="round">
              <path d="M4 8 V5.5 A1.5 1.5 0 0 1 5.5 4 H8" />
              <path d="M16 4 h2.5 A1.5 1.5 0 0 1 20 5.5 V8" />
              <path d="M20 16 v2.5 a1.5 1.5 0 0 1 -1.5 1.5 H16" />
              <path d="M8 20 H5.5 A1.5 1.5 0 0 1 4 18.5 V16" />
              <path d="M4 12 h16" />
            </svg>
          </span>
          <span className="text-[13px] font-semibold">Scan</span>
        </button>
        <button onClick={onReceive} className="flex flex-col items-center gap-2" aria-label="Receive">
          <span className="flex size-12 items-center justify-center rounded-full bg-white/8 ring-1 ring-white/10">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#f7f5f2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4 L4 12 M4 12 H10 M4 12 V6" />
            </svg>
          </span>
          <span className="text-[12px] text-stone">Receive</span>
        </button>
      </div>
      <div className="px-6 pt-6">
        <button
          onClick={onBuy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/6 py-3.5 text-[14px] font-semibold ring-1 ring-white/10"
        >
          <span className="text-orange">+</span> Buy bitcoin with M-Pesa
        </button>
      </div>
      <div className="mt-auto px-6 pb-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[14px] font-bold">Activity</span>
          <span className="text-[12px] text-stone">See all</span>
        </div>
        {[
          lastEvent ?? { label: "Chapati Point · Till 118 220", sats: "-1,850" },
          { label: "Received · Lightning", sats: "+12,000" },
        ].map((r) => (
          <div key={r.label} className="flex items-center justify-between border-t border-white/8 py-2.5">
            <span className="text-[12px] text-stone">{r.label}</span>
            <span
              className={`text-[12px] font-semibold ${r.sats.startsWith("+") ? "text-orange" : "text-ivory"}`}
            >
              {r.sats} sats
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScanScreen({
  detected,
  rail = "mpesa",
  setRail,
  onPay,
  onClose,
  demo,
}: {
  detected: boolean;
  rail?: Rail;
  setRail?: (r: Rail) => void;
  onPay?: () => void;
  onClose?: () => void;
  demo?: boolean;
}) {
  return (
    <div className="relative flex h-full flex-col bg-[#100f0d] text-ivory">
      <StatusBar />
      <div className="flex items-center justify-between px-5 pt-3">
        <button
          onClick={onClose}
          aria-label="Close scanner"
          className="flex size-9 items-center justify-center rounded-full bg-white/10 text-[16px]"
        >
          ×
        </button>
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-stone">
          Scan to pay
        </span>
        <span className="flex size-9 items-center justify-center rounded-full bg-white/10 text-orange">⚡</span>
      </div>
      <div className="relative mx-auto mt-8 w-[76%]">
        <div className="relative overflow-hidden rounded-2xl bg-white p-4">
          <QR className="w-full" />
          {!detected && (
            <span className="animate-scanline absolute left-2 right-2 h-[2px] rounded bg-orange/90 shadow-[0_0_12px_rgba(238,144,28,0.9)]" />
          )}
        </div>
        {(["tl", "tr", "bl", "br"] as const).map((c) => (
          <span
            key={c}
            className={`absolute size-6 border-orange ${
              c === "tl"
                ? "-left-2 -top-2 rounded-tl-lg border-l-[3px] border-t-[3px]"
                : c === "tr"
                  ? "-right-2 -top-2 rounded-tr-lg border-r-[3px] border-t-[3px]"
                  : c === "bl"
                    ? "-bottom-2 -left-2 rounded-bl-lg border-b-[3px] border-l-[3px]"
                    : "-bottom-2 -right-2 rounded-br-lg border-b-[3px] border-r-[3px]"
            }`}
          />
        ))}
      </div>
      <AnimatePresence>
        {detected && (
          <motion.div
            initial={demo ? false : { y: "104%" }}
            animate={{ y: 0 }}
            exit={{ y: "104%" }}
            transition={{ duration: 0.45, ease: EASE }}
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-ivory p-5 text-ink"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" />
            <div className={`mb-4 grid grid-cols-2 gap-1 rounded-full bg-ink/6 p-1 ${demo ? "demo-railflip" : ""}`}>
              {(
                [
                  ["mpesa", "M-Pesa till"],
                  ["lightning", "Lightning"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setRail?.(k)}
                  data-rail={k}
                  className={`rounded-full py-1.5 text-[12px] font-semibold transition-colors ${
                    rail === k ? "bg-ink text-ivory" : "text-ink/55"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-copper">
              <span className="size-[5px] animate-pulse bg-orange" />
              Detected automatically
            </p>
            <p className="mt-2 text-[16px] font-bold">
              {rail === "mpesa" ? `${PAY.merchant} · Till ${PAY.till}` : PAY.invoice}
            </p>
            <p className="mt-0.5 text-[13px] text-ink/60">
              {rail === "mpesa"
                ? `${PAY.place} · KES ${PAY.kes}`
                : `Lightning invoice · ${fmt(PAY.sats)} sats`}
            </p>
            <button
              onClick={(e) => {
                pressPulse(e.currentTarget);
                onPay?.();
              }}
              className="mt-4 w-full rounded-2xl bg-orange py-3.5 text-[15px] font-bold text-ink"
            >
              Review payment
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ConfirmScreen({
  flow = { kind: "pay", rail: "mpesa" } as Flow,
  onDone,
  onBack,
  demo,
}: {
  flow?: Flow;
  onDone?: () => void;
  onBack?: () => void;
  demo?: boolean;
}) {
  const isPay = flow.kind === "pay";
  const isSendLn = flow.kind === "send" && flow.target === "ln";
  const payee = isPay
    ? flow.rail === "mpesa"
      ? PAY.merchant
      : PAY.invoice
    : flow.kind === "send"
      ? flow.target === "mpesa"
        ? SEND.phone
        : SEND.ln
      : "";
  const payeeSub = isPay
    ? flow.rail === "mpesa"
      ? `M-Pesa till ${PAY.till} · ${PAY.place}`
      : "Lightning invoice"
    : flow.kind === "send"
      ? flow.target === "mpesa"
        ? "Phone number → M-Pesa"
        : "Lightning address"
      : "";
  const sats = isPay ? PAY.sats : isSendLn ? SEND.lnSats : SEND.phoneSats;
  const sub = isPay
    ? flow.rail === "mpesa"
      ? `They receive KES ${PAY.kes}`
      : `≈ KES ${PAY.kes}`
    : isSendLn
      ? `≈ KES ${SEND.lnSats / 100}`
      : `They receive KES ${SEND.phoneKes}`;
  const railLabel =
    (isPay && flow.rail === "mpesa") || (flow.kind === "send" && flow.target === "mpesa")
      ? "Lightning → M-Pesa"
      : "Lightning";
  return (
    <div className="flex h-full flex-col bg-ivory text-ink">
      <StatusBar light />
      <LightHeader title="Confirm payment" onBack={onBack} />
      <div className="mx-5 mt-6 rounded-2xl bg-white p-4 shadow-[0_2px_14px_rgba(23,23,19,0.06)]">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-stone">Paying</p>
        <p className="mt-1.5 text-[15px] font-bold">{payee}</p>
        <p className="text-[12px] text-ink/55">{payeeSub}</p>
      </div>
      <div className="px-5 pt-7 text-center">
        <p className="text-[13px] text-ink/55">You send</p>
        <p className="mt-1 text-[32px] font-extrabold leading-none">
          {fmt(sats)}{" "}
          <span className="text-[16px] font-semibold text-ink/45">sats</span>
        </p>
        <p className="mt-1.5 text-[13px] text-ink/55">{sub}</p>
      </div>
      <div className="mx-5 mt-6 space-y-2 border-t border-ink/8 pt-4 text-[12px]">
        <div className="flex justify-between">
          <span className="text-ink/50">Network fee</span>
          <span className="font-semibold">{PAY.fee} sats</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink/50">Rail</span>
          <span className="font-semibold">{railLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink/50">Custody</span>
          <span className="font-semibold text-copper">Your keys, start to finish</span>
        </div>
      </div>
      <div className="mt-auto px-5 pb-7">
        <HoldToPay onDone={() => onDone?.()} demo={demo} />
        <p className="mt-2.5 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-stone">
          Hold for one second to settle
        </p>
      </div>
    </div>
  );
}

export function SuccessScreen({
  flow = { kind: "pay", rail: "mpesa" } as Flow,
  onHome,
}: {
  flow?: Flow;
  onHome?: () => void;
}) {
  const line =
    flow.kind === "buy"
      ? `KES ${fmt(flow.kes)} → ${fmt(flow.kes * 100)} sats`
      : flow.kind === "send"
        ? flow.target === "mpesa"
          ? `${SEND.phone} · KES ${SEND.phoneKes} · ${fmt(SEND.phoneSats)} sats`
          : `${SEND.ln} · ${fmt(SEND.lnSats)} sats`
        : `${PAY.merchant} · KES ${PAY.kes} · ${fmt(PAY.sats)} sats`;
  const note =
    flow.kind === "buy"
      ? "Bought with M-Pesa, held by your keys. No exchange account, no waiting."
      : flow.kind === "send"
        ? flow.target === "mpesa"
          ? "They got shillings on their phone. You paid straight from your keys."
          : "Invoice paid straight from your keys."
        : "The till got shillings. You never gave up your keys.";
  const rail =
    flow.kind === "buy"
      ? "M-Pesa → Lightning"
      : (flow.kind === "pay" && flow.rail === "lightning") ||
          (flow.kind === "send" && flow.target === "ln")
        ? "Lightning"
        : "Lightning → M-Pesa";
  const title = flow.kind === "buy" ? "Bought. Yours." : "Paid. Settled.";
  return (
    <div className="flex h-full flex-col bg-ivory text-ink">
      <StatusBar light />
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ scale: 0, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 17, delay: 0.05 }}
          className="flex size-16 items-center justify-center bg-orange"
        >
          <motion.svg
            width="30"
            height="30"
            viewBox="0 0 30 30"
            fill="none"
            stroke="#171713"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <motion.path
              d="M6 16 L12.5 22.5 L24 8.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.28, ease: "easeOut" }}
            />
          </motion.svg>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.5, ease: EASE }}
        >
          <p className="mt-6 text-[24px] font-extrabold">{title}</p>
          <p className="mt-1.5 text-[13px] text-ink/60">{line}</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-stone">
            1.4 seconds · {rail}
          </p>
          <p className="mx-auto mt-5 max-w-[230px] text-[12px] leading-relaxed text-ink/55">
            {note}
          </p>
        </motion.div>
      </div>
      <div className="px-5 pb-7">
        <button
          onClick={(e) => {
            pressPulse(e.currentTarget);
            onHome?.();
          }}
          className="w-full rounded-2xl bg-ink py-3.5 text-[15px] font-bold text-ivory"
        >
          Done
        </button>
      </div>
    </div>
  );
}

export function SendScreen({
  onPick,
  onBack,
  demo,
}: {
  onPick?: (t: "mpesa" | "ln") => void;
  onBack?: () => void;
  demo?: boolean;
}) {
  const [sel, setSel] = useState<"mpesa" | "ln" | null>(demo ? "mpesa" : null);
  return (
    <div className="flex h-full flex-col bg-ivory text-ink">
      <StatusBar light />
      <LightHeader title="Send" onBack={onBack} />
      <div className="px-5 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone">To</p>
        <div className="mt-2 rounded-2xl bg-white px-4 py-3.5 text-[14px] text-ink/40 shadow-[0_2px_14px_rgba(23,23,19,0.05)]">
          {sel === "mpesa" ? SEND.phone : sel === "ln" ? SEND.ln : "Phone number or Lightning address"}
        </div>
      </div>
      <div className="px-5 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone">Try one</p>
        <div className="mt-2 space-y-2.5">
          <button
            onClick={() => setSel("mpesa")}
            className={`flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-[0_2px_14px_rgba(23,23,19,0.05)] ring-2 transition-all ${
              sel === "mpesa" ? "ring-orange" : "ring-transparent"
            }`}
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-orange/15 text-copper">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M3.5 1.5 h3 l1 3.5 -1.8 1.2 a8.5 8.5 0 0 0 3.6 3.6 l1.2 -1.8 3.5 1 v3 a1 1 0 0 1 -1 1 A12 12 0 0 1 2.5 2.5 a1 1 0 0 1 1 -1 Z" />
              </svg>
            </span>
            <span>
              <span className="block text-[14px] font-bold">{SEND.phone}</span>
              <span className="block text-[12px] text-ink/55">Phone number → M-Pesa</span>
            </span>
          </button>
          <button
            onClick={() => setSel("ln")}
            className={`flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-[0_2px_14px_rgba(23,23,19,0.05)] ring-2 transition-all ${
              sel === "ln" ? "ring-orange" : "ring-transparent"
            }`}
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-orange/15 text-copper">⚡</span>
            <span>
              <span className="block text-[14px] font-bold">{SEND.ln}</span>
              <span className="block text-[12px] text-ink/55">Lightning address</span>
            </span>
          </button>
        </div>
      </div>
      <div className="mt-auto px-5 pb-7">
        <button
          disabled={!sel}
          onClick={(e) => {
            if (!sel) return;
            pressPulse(e.currentTarget);
            onPick?.(sel);
          }}
          className={`w-full rounded-2xl py-3.5 text-[15px] font-bold transition-colors ${
            sel ? "bg-orange text-ink" : "bg-ink/8 text-ink/35"
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

export function ReceiveScreen({
  onBack,
  demo,
}: {
  onBack?: () => void;
  demo?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex h-full flex-col bg-ivory text-ink">
      <StatusBar light />
      <LightHeader title="Receive" onBack={onBack} />
      <div className="mt-3 flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-orange/15 px-3.5 py-1.5 text-[12px] font-semibold text-copper">
          ⚡ Lightning
        </span>
      </div>
      <div className={`mx-auto mt-5 w-[68%] rounded-3xl bg-white p-5 shadow-[0_2px_18px_rgba(23,23,19,0.07)] ${demo ? "demo-qrpulse" : ""}`}>
        <QR seed={11} className="w-full" />
      </div>
      <div className="mt-5 flex justify-center">
        <button
          onClick={() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }}
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[14px] font-bold shadow-[0_2px_14px_rgba(23,23,19,0.06)]"
        >
          {MY_ADDRESS}
          <span className="text-[11px] font-semibold text-copper">
            {copied ? "Copied" : "Copy"}
          </span>
        </button>
      </div>
      <p className="mt-3 text-center text-[12px] text-stone">
        Anyone can pay you at this address
      </p>
      <div className="mt-auto px-5 pb-7">
        <button
          onClick={onBack}
          className="w-full rounded-2xl bg-ink py-3.5 text-[15px] font-bold text-ivory"
        >
          Done
        </button>
      </div>
    </div>
  );
}

export function BuyScreen({
  onComplete,
  onBack,
  demo,
}: {
  onComplete?: (kes: number) => void;
  onBack?: () => void;
  demo?: boolean;
}) {
  const [kes, setKes] = useState(demo ? 500 : 0);
  const [pushing, setPushing] = useState(false);
  const type = (d: number) => setKes((k) => Math.min(k * 10 + d, 99_999));
  const back = () => setKes((k) => Math.floor(k / 10));
  const start = () => {
    if (!kes || demo) return;
    setPushing(true);
    setTimeout(() => {
      setPushing(false);
      onComplete?.(kes);
    }, 1700);
  };
  return (
    <div className="relative flex h-full flex-col bg-ivory text-ink">
      <StatusBar light />
      <LightHeader title="Buy bitcoin" onBack={onBack} />
      <p className="mt-1 text-center text-[12px] text-stone">You pay with M-Pesa</p>
      <div className="mt-4 text-center">
        <p className="text-[34px] font-extrabold leading-none">
          <span className="mr-2 text-[16px] font-bold text-ink/40">KES</span>
          {fmt(kes)}
        </p>
        <p className="mt-1.5 text-[13px] font-semibold text-copper">≈ {fmt(kes * 100)} sats</p>
      </div>
      <div className="mt-4 flex justify-center gap-2">
        {[500, 1000, 2000, 5000].map((v) => (
          <button
            key={v}
            onClick={() => setKes(v)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold shadow-[0_1px_8px_rgba(23,23,19,0.06)] ${
              kes === v ? "bg-ink text-ivory" : "bg-white text-ink"
            }`}
          >
            {fmt(v)}
          </button>
        ))}
      </div>
      <div className="mx-auto mt-4 grid w-[78%] grid-cols-3 gap-y-2 text-center">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} onClick={() => type(d)} className="py-2 text-[20px] font-semibold">
            {d}
          </button>
        ))}
        <span />
        <button onClick={() => type(0)} className="py-2 text-[20px] font-semibold">
          0
        </button>
        <button onClick={back} aria-label="Delete digit" className="py-2 text-[16px]">
          ⌫
        </button>
      </div>
      <div className="mt-auto px-5 pb-7">
        <button
          disabled={!kes}
          onClick={start}
          className={`w-full rounded-2xl py-3.5 text-[15px] font-bold transition-colors ${
            kes ? "bg-orange text-ink" : "bg-ink/8 text-ink/35"
          }`}
        >
          Continue
        </button>
      </div>
      <AnimatePresence>
        {pushing && (
          <motion.div
            initial={{ y: "104%" }}
            animate={{ y: 0 }}
            exit={{ y: "104%" }}
            transition={{ duration: 0.4, ease: EASE }}
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-ink p-6 text-ivory"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-orange">
              <span className="size-[5px] animate-pulse bg-orange" />
              M-Pesa request sent
            </p>
            <p className="mt-2 text-[16px] font-bold">Check your phone</p>
            <p className="mt-1 text-[13px] text-ivory/60">
              Approve KES {fmt(kes)} with your M-Pesa PIN. Sats land the moment it clears.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =========================================================
   THE DEVICE — interactive state machine
   ========================================================= */
export function PhoneSim({
  className,
  onState,
  autoDetectMs = 1500,
}: {
  className?: string;
  onState?: (s: PhoneState) => void;
  autoDetectMs?: number;
}) {
  const [state, setState] = useState<PhoneState>("home");
  const [flow, setFlow] = useState<Flow>({ kind: "pay", rail: "mpesa" });
  const [paidOut, setPaidOut] = useState(0);
  const [boughtIn, setBoughtIn] = useState(0);
  const [lastEvent, setLastEvent] = useState<{ label: string; sats: string } | null>(null);

  const go = useCallback(
    (s: PhoneState) => {
      setState(s);
      onState?.(s);
    },
    [onState],
  );

  useEffect(() => {
    if (state !== "scan") return;
    const t = setTimeout(() => go("detected"), autoDetectMs);
    return () => clearTimeout(t);
  }, [state, autoDetectMs, go]);

  const balance = START_BAL - paidOut + boughtIn;

  useEffect(() => {
    const el = document.documentElement as unknown as Record<string, unknown>;
    el.__apPhoneGo = (s: PhoneState) => {
      if (s === "detected" || s === "confirm") setFlow({ kind: "pay", rail: "mpesa" });
      go(s);
    };
  }, [go]);

  const settle = () => {
    if (flow.kind === "pay") {
      setPaidOut((p) => p + PAY.sats + PAY.fee);
      setLastEvent({ label: `${PAY.merchant} · Till ${PAY.till}`, sats: `-${fmt(PAY.sats + PAY.fee)}` });
    } else if (flow.kind === "send") {
      const s = flow.target === "ln" ? SEND.lnSats : SEND.phoneSats;
      setPaidOut((p) => p + s + SEND.fee);
      setLastEvent({
        label: flow.target === "ln" ? `Sent · ${SEND.ln}` : `Sent · ${SEND.phone}`,
        sats: `-${fmt(s + SEND.fee)}`,
      });
    }
    go("success");
  };

  const screen =
    state === "home" ? (
      <HomeScreen
        balance={balance}
        lastEvent={lastEvent}
        onScan={() => {
          setFlow({ kind: "pay", rail: "mpesa" });
          go("scan");
        }}
        onSend={() => go("send")}
        onReceive={() => go("receive")}
        onBuy={() => go("buy")}
      />
    ) : state === "scan" || state === "detected" ? (
      <ScanScreen
        detected={state === "detected"}
        rail={flow.kind === "pay" ? flow.rail : "mpesa"}
        setRail={(r) => setFlow({ kind: "pay", rail: r })}
        onPay={() => go("confirm")}
        onClose={() => go("home")}
      />
    ) : state === "confirm" ? (
      <ConfirmScreen flow={flow} onDone={settle} onBack={() => go(flow.kind === "pay" ? "detected" : "send")} />
    ) : state === "success" ? (
      <SuccessScreen flow={flow} onHome={() => go("home")} />
    ) : state === "send" ? (
      <SendScreen
        onBack={() => go("home")}
        onPick={(t) => {
          setFlow({ kind: "send", target: t });
          go("confirm");
        }}
      />
    ) : state === "receive" ? (
      <ReceiveScreen onBack={() => go("home")} />
    ) : (
      <BuyScreen
        onBack={() => go("home")}
        onComplete={(k) => {
          setFlow({ kind: "buy", kes: k });
          setBoughtIn((b) => b + k * 100);
          setLastEvent({ label: "Bought · M-Pesa", sats: `+${fmt(k * 100)}` });
          go("success");
        }}
      />
    );

  const screenKey = state === "scan" || state === "detected" ? "scanner" : state;

  return (
    <div className={className}>
      <div className="relative mx-auto w-[290px] md:w-[310px]">
        <div className="relative overflow-hidden rounded-[46px] bg-[#0c0b0a] p-[10px] shadow-[0_36px_90px_-28px_rgba(23,23,19,0.55)] ring-1 ring-white/10">
          <div className="relative h-[600px] overflow-hidden rounded-[36px] bg-[#141311] md:h-[620px]">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={screenKey}
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 0.985, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.985, y: -10 }}
                transition={{ duration: 0.32, ease: EASE }}
              >
                {screen}
              </motion.div>
            </AnimatePresence>
          </div>
          <span className="pointer-events-none absolute inset-x-0 bottom-[16px] mx-auto h-1 w-24 rounded-full bg-white/25" />
        </div>
      </div>
    </div>
  );
}

/* Static, self-animating screens for the scroll tour. */
export type TourKind =
  | "home"
  | "scan"
  | "detected"
  | "confirm"
  | "success"
  | "send"
  | "receive"
  | "buy";

export function TourScreen({ kind }: { kind: TourKind }) {
  switch (kind) {
    case "home":
      return <HomeScreen />;
    case "scan":
      return <ScanScreen detected={false} demo />;
    case "detected":
      return <ScanScreen detected demo />;
    case "confirm":
      return <ConfirmScreen demo />;
    case "success":
      return <SuccessScreen />;
    case "send":
      return <SendScreen demo />;
    case "receive":
      return <ReceiveScreen demo />;
    case "buy":
      return <BuyScreen demo />;
  }
}
