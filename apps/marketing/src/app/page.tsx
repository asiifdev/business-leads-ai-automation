import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { Stats } from "@/components/stats";
import { Features } from "@/components/features";
import { HowItWorks } from "@/components/how-it-works";
import { OpenSource } from "@/components/open-source";
import { Footer } from "@/components/footer";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 overflow-x-hidden">
      <Navbar />
      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <OpenSource />
      <Footer />
    </main>
  );
}
