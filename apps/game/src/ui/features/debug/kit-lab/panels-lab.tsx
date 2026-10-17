import { GameProvider } from "@/hooks/context/game-context";
import { useDocumentClass } from "@/hooks/use-document-class";
import { HoldingsList, useHoldings } from "@/ui/features/world/hud/holdings";
import { RealmCard } from "@/ui/features/world/hud/realm-card";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { useState } from "react";

import { installFixtureGame, PLAYER } from "./fixture-game";

/**
 * Dev only: the Blitz and Eternum HUD's panels as a player sees them, the real components on the deploy fixture's
 * realm in the War room skin, at /lab/kit/panels: the holdings and the selected realm's card, which a spectated game
 * does not show.
 */
export const PanelsLab = () => {
  useDocumentClass("classic-hud");
  const [store] = useState(installFixtureGame);
  return (
    <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: PLAYER } as never}>
      <div className="flex min-h-screen items-start gap-6 bg-[#0b1418] p-6 text-gold">
        <div className="flex w-[320px] flex-col gap-2">
          <LabHoldings />
        </div>
      </div>
    </GameProvider>
  );
};

const LabHoldings = () => {
  const holdings = useHoldings();
  return (
    <>
      <HoldingsList holdings={holdings} />
      <RealmCard holding={holdings.selected} />
    </>
  );
};
