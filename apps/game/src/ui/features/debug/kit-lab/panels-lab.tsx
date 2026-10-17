import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useDocumentClass } from "@/hooks/use-document-class";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { HoldingsList, useHoldings } from "@/ui/features/world/hud/holdings";
import { RealmCard } from "@/ui/features/world/hud/realm-card";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { useState } from "react";

/** The fixture's player, who holds its realm (entity 7). */
const PLAYER = "0x111";

/**
 * The deploy fixture's game, made the one this page plays before anything draws: what the HUD reads that the fixture
 * leaves out (the upgrade limits, the chain's clock), the fixture's player signed in, and its realm selected.
 */
const installFixtureGame = () => {
  const { store } = frontierDay();
  store.applyFacts([
    { model: "UpgradeLimits", key: "0x9", value: { game_id: 1, realm_max: 3, village_max: 3 } },
  ] as never);
  useChainTimeStore.getState().anchor({ timestamp: 350_000 });
  useAccountStore.setState({ account: { address: PLAYER } as never });
  useUIStore.setState({ structureEntityId: 7 });
  return store;
};

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
