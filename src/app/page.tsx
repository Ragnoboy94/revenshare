import type { Metadata } from "next";
import { CaseNaviCert } from "@/components/CaseNaviCert";
import { FAQ } from "@/components/FAQ";
import { FitAudience } from "@/components/FitAudience";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { LeadForm } from "@/components/LeadForm";
import { ProblemSolution } from "@/components/ProblemSolution";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { TermsClear } from "@/components/TermsClear";
import { SEO } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  description: SEO.description,
};

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <ProblemSolution />
        <HowItWorks />
        <TermsClear />
        <FitAudience />
        <CaseNaviCert />
        <FAQ />
        <LeadForm />
      </main>
      <SiteFooter />
    </>
  );
}
