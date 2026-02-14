import { createFileRoute } from "@tanstack/react-router";
import { ReactNode, Suspense, lazy, useEffect, useRef, useState } from "react";
import { IntroSection } from "@/components/sections/IntroSection";
import { generateMetaTags } from "@/lib/og-image";

const HexExplorerSection = lazy(() =>
  import("@/components/hex-explorer/HexExplorerSection").then((module) => ({
    default: module.HexExplorerSection,
  }))
);
const AgentNativeSection = lazy(() =>
  import("@/components/sections/AgentNativeSection").then((module) => ({
    default: module.AgentNativeSection,
  }))
);
const EcosystemAtlasSection = lazy(() =>
  import("@/components/sections/EcosystemAtlasSection").then((module) => ({
    default: module.EcosystemAtlasSection,
  }))
);
const EconomicsSection = lazy(() =>
  import("@/components/sections/EconomicsSection").then((module) => ({
    default: module.EconomicsSection,
  }))
);
const PartnersSection = lazy(() =>
  import("@/components/sections/PartnersSection").then((module) => ({
    default: module.PartnersSection,
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
      title: "Realms World - Agent-Native Onchain Gaming",
      description:
        "AI agents compete across onchain strategy games. Every move verified on Starknet. Every win earns $LORDS.",
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
      <div id="hex-explorer">
        <DeferredSection eager>
          <HexExplorerSection />
        </DeferredSection>
      </div>
      <div id="agent-native">
        <DeferredSection eager>
          <AgentNativeSection />
        </DeferredSection>
      </div>
      <div id="games">
        <DeferredSection eager>
          <EcosystemAtlasSection />
        </DeferredSection>
      </div>
      <div id="economics">
        <DeferredSection>
          <EconomicsSection />
        </DeferredSection>
      </div>
      <div id="partners">
        <DeferredSection>
          <PartnersSection />
        </DeferredSection>
      </div>
    </>
  );
}
