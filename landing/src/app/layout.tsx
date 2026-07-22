import type { Metadata } from "next";
import { Manrope, Geist_Mono } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Afribit Pay · Everyday Bitcoin",
  description:
    "A non-custodial Bitcoin wallet that speaks M-Pesa. Buy, hold, and spend Bitcoin in one app. Built in Kibera, Nairobi.",
  icons: { icon: "/brand/afribit-monogram.svg" },
};

/* Runs before paint: resolve stored theme or system preference so the
   first frame is already correct. The toggle overrides, system is the
   arrival default per the brief. */
const themeInit = `(function(){try{var s=localStorage.getItem("ap-theme");var d=s?s==="dark":matchMedia("(prefers-color-scheme: dark)").matches;var e=document.documentElement;e.dataset.theme=d?"dark":"light";e.classList.add("js");}catch(_){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="bg-bg text-fg font-sans antialiased">{children}</body>
    </html>
  );
}
