import { createFileRoute } from "@tanstack/react-router";
import { IntroSection } from "@/components/sections/IntroSection";
import { GamesSection } from "@/components/sections/GamesSection";
import { ValueFlowSection } from "@/components/sections/ValueFlowSection";
import { TokenomicsSection } from "@/components/sections/TokenomicsSection";
import { TreasurySection } from "@/components/sections/TreasurySection";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      {
        title: "Realms World - Onchain Gaming Powered by $LORDS",
      },
      {
        name: "description",
        content:
          "The future of gaming is onchain. Explore games powered by $LORDS token in the Realms ecosystem.",
      },
    ],
  }),
});

function HomePage() {
  return (
    <>
      <IntroSection />
      <GamesSection />
      <ValueFlowSection />
      <TokenomicsSection />
      <TreasurySection />
    </>
  );
}
