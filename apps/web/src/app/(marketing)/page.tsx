import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Hero } from "@/components/landing/hero";
import { ProductPreview } from "@/components/landing/product-preview";
import {
  AiSection,
  CollaborationSection,
  HistorySection,
  OfflineSection,
  SecuritySection,
} from "@/components/landing/feature-sections";
import { CtaSection } from "@/components/landing/cta-section";

/**
 * Landing page.
 *
 * Structured as a single argument rather than a feature wall: hero →
 * the real interface → the three hard guarantees (collaboration, offline,
 * history) → the two supporting ones (AI, access control) → close. Each band
 * demonstrates its mechanism, so a visitor can tell which claims are the
 * product's differentiators and which are table stakes.
 */
export default async function Home() {
  const session = await auth();
  if (session?.user?.id) redirect("/documents");

  return (
    <main className="flex flex-1 flex-col">
      <Hero />

      <section
        id="product"
        aria-label="Product preview"
        className="scroll-mt-16 border-b border-border bg-muted/25 py-12 sm:py-16"
      >
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              The whole product, in one window
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-pretty text-muted-foreground">
              This is not a mockup — every panel below is built from the same
              components the running application renders. Switch between them to
              see how the interface changes per surface.
            </p>
          </div>
          <ProductPreview />
        </div>
      </section>

      <CollaborationSection />
      <OfflineSection />
      <HistorySection />
      <AiSection />
      <SecuritySection />
      <CtaSection />
    </main>
  );
}
