import { createFileRoute } from "@tanstack/react-router";
import { IntroSection } from "@/components/sections/IntroSection";
import { GamesSection } from "@/components/sections/GamesSection";
import { ValueFlowSection } from "@/components/sections/ValueFlowSection";
// import { VelordsAPYSection } from "@/components/sections/VelordsAPYSection";
import { TokenomicsSection } from "@/components/sections/TokenomicsSection";
import { TreasurySection } from "@/components/sections/TreasurySection";
import { PartnersSection } from "@/components/sections/PartnersSection";
import { Helmet } from "react-helmet-async";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://realms.world";

  return (
    <>
      <Helmet>
        <title>Realms World - Onchain Gaming Powered by $LORDS</title>
        <meta
          name="description"
          content="The future of gaming is onchain. Explore games powered by $LORDS token in the Realms ecosystem."
        />

        {/* Open Graph tags */}
        <meta
          property="og:title"
          content="Realms World - Onchain Gaming Powered by $LORDS"
        />
        <meta
          property="og:description"
          content="The future of gaming is onchain. Explore games powered by $LORDS token in the Realms ecosystem."
        />
        <meta
          property="og:image"
          content={`${origin}/api/og?title=${encodeURIComponent(
            "Realms World"
          )}&description=${encodeURIComponent(
            "The future of gaming is onchain"
          )}`}
        />
        <meta property="og:url" content={origin} />
        <meta property="og:type" content="website" />

        {/* Twitter Card tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Realms World - Onchain Gaming Powered by $LORDS"
        />
        <meta
          name="twitter:description"
          content="The future of gaming is onchain. Explore games powered by $LORDS token in the Realms ecosystem."
        />
        <meta
          name="twitter:image"
          content={`${origin}/api/og?title=${encodeURIComponent(
            "Realms World"
          )}&description=${encodeURIComponent(
            "The future of gaming is onchain"
          )}`}
        />
      </Helmet>

      <div id="hero">
        <IntroSection />
      </div>
      <div id="games">
        <GamesSection />
      </div>
      <div id="partners">
        <PartnersSection />
      </div>
      <div id="value-flow">
        <ValueFlowSection />
      </div>
      <div id="velords">{/* <VelordsAPYSection /> */}</div>
      <div id="tokenomics">
        <TokenomicsSection />
      </div>
      <div id="treasury">
        <TreasurySection />
      </div>
    </>
  );
}
