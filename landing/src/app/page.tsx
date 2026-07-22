import { Nav } from "@/components/Nav";
import { Hero, Marquee } from "@/components/Hero";
import { Problem } from "@/components/Problem";
import { Showcase } from "@/components/Showcase";
import { ProductTour } from "@/components/ProductTour";
import { Custody } from "@/components/Custody";
import { Kibera } from "@/components/Kibera";
import { CTA, Footer } from "@/components/CTA";

export default function Page() {
  return (
    <main>
      <Nav />
      <Hero />
      <Marquee />
      <Problem />
      <ProductTour />
      <Showcase />
      <Custody />
      <Kibera />
      <CTA />
      <Footer />
    </main>
  );
}
