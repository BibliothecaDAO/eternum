import { GameProvider } from "@/hooks/context/game-context";
import { useDocumentClass } from "@/hooks/use-document-class";
import { TopHeader } from "@/ui/features/world/containers/top-header/top-header";
import { HoldingsList, useHoldings } from "@/ui/features/world/hud/holdings";
import { HudMinimap } from "@/ui/features/world/hud/minimap";
import { RealmCard } from "@/ui/features/world/hud/realm-card";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { installFixtureGame, PLAYER } from "./fixture-game";

/**
 * Dev only: the Blitz and Eternum HUD's panels as a player sees them, the real components on the deploy fixture's
 * realm in the War room skin, at /lab/kit/panels: the left column (the holdings, the selected realm's card and the
 * minimap), which a spectated game does not show, or the top bar alone with `?part=top-header` (it selects for the
 * page, so it never shares one with the holdings). Each part carries the `data-lab` mark the HUD captures
 * (scripts/capture-hud-lab.mjs) look for.
 */
export const PanelsLab = () => {
  useDocumentClass("classic-hud");
  const [store] = useState(installFixtureGame);
  const [params] = useSearchParams();
  return (
    <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: PLAYER } as never}>
      <div className="flex min-h-screen flex-col items-start gap-6 bg-[#0b1418] p-6 text-gold">
        {params.get("part") === "top-header" ? (
          <div data-lab="top-header">
            <TopHeader />
          </div>
        ) : (
          <div data-lab="left-column" className="flex w-[320px] flex-col gap-2">
            <LabHoldings />
            <HudMinimap className="w-full" />
          </div>
        )}
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
