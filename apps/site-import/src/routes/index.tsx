import { createFileRoute } from "@tanstack/react-router";
import { ReactNode, Suspense, lazy, useEffect, useRef, useState } from "react";
import { IntroSection } from "@/components/sections/IntroSection";
import { generateMetaTags } from "@/lib/og-image";

const GamesSection = lazy(() =>
  import("@/components/sections/GamesSection").then((module) => ({
    default: module.GamesSection,
  }))
);
const PartnersSection = lazy(() =>
  import("@/components/sections/PartnersSection").then((module) => ({
    default: module.PartnersSection,
  }))
);
const ValueFlowSection = lazy(() =>
  import("@/components/sections/ValueFlowSection").then((module) => ({
    default: module.ValueFlowSection,
  }))
);
const TokenomicsSection = lazy(() =>
  import("@/components/sections/TokenomicsSection").then((module) => ({
    default: module.TokenomicsSection,
  }))
);
const TreasurySection = lazy(() =>
  import("@/components/sections/TreasurySection").then((module) => ({
    default: module.TreasurySection,
  }))
);

function SectionFallback() {
  return (
    <div className="min-h-[220px] rounded-xl border border-border/40 bg-muted/20 animate-pulse" />
  );
}

function DeferredSection({
  children,
  eager = false,
}: {
  children: ReactNode;
  eager?: boolean;
}) {
  const [isVisible, setIsVisible] = useState(eager);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isVisible) return;

    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div ref={sectionRef}>
      {isVisible ? (
        <Suspense fallback={<SectionFallback />}>{children}</Suspense>
      ) : (
        <SectionFallback />
      )}
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: generateMetaTags({
      title: "Realms World - Onchain Gaming Powered by $LORDS",
      description:
        "The future of gaming is onchain. Explore games powered by $LORDS token in the Realms ecosystem.",
      path: "/",
    }),
  }),
});

function HomePage() {
  return (
    <>
      <div id="hero">
        <IntroSection />
      </div>
      <div id="games">
        <DeferredSection eager>
          <GamesSection />
        </DeferredSection>
      </div>
      <div id="partners">
        <DeferredSection>
          <PartnersSection />
        </DeferredSection>
      </div>
      <div id="value-flow">
        <DeferredSection>
          <ValueFlowSection />
        </DeferredSection>
      </div>
      <div id="tokenomics">
        <DeferredSection>
          <TokenomicsSection />
        </DeferredSection>
      </div>
      <div id="treasury">
        <DeferredSection>
          <TreasurySection />
        </DeferredSection>
      </div>
    </>
  );
}
