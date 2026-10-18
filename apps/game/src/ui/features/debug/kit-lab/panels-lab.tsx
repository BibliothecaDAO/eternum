import { GameProvider } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { campBeside } from "@/ui/features/frontier/sites/site-fixture";
import { SelectedWorldmapEntity } from "@/ui/features/world/components/actions/selected-worldmap-entity";
import { useDocumentClass } from "@/hooks/use-document-class";
import { TopHeader } from "@/ui/features/world/containers/top-header/top-header";
import { HoldingsList, useHoldings } from "@/ui/features/world/hud/holdings";
import { HudMinimap } from "@/ui/features/world/hud/minimap";
import { RealmCard } from "@/ui/features/world/hud/realm-card";
import type { GameClientSetup, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { BiomeType, BiomeTypeToId } from "@bibliothecadao/types";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { nativeTilePackingConstants } from "../../../../../../../contracts/l3/world-native/schema/client.gen";
import { installFixtureGame, PLAYER } from "./fixture-game";

/**
 * Dev only: the Blitz and Eternum HUD's panels as a player sees them, the real components on the deploy fixture's
 * realm in the War room skin, at /lab/kit/panels: the left column (the holdings, the selected realm's card and the
 * minimap), which a spectated game does not show, or the top bar alone with `?part=top-header` (it selects for the
 * page, so it never shares one with the holdings), or the picked tile alone with `?tile=army|empty` (the sites
 * fixture's army beside its camp, a bare forest). Each part carries the `data-lab` mark the HUD captures
 * (scripts/capture-hud-lab.mjs) look for.
 */
export const PanelsLab = () => {
  const [params] = useSearchParams();
  const tile = params.get("tile");
  return tile === "army" || tile === "empty" ? <TileLab tile={tile} /> : <ColumnLab />;
};

const ColumnLab = () => {
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

/** The lab's tiles: the sites fixture's army (41, 12) on grass, and a bare forest two hexes off. */
const LAB_TILES = {
  army: { col: 41, row: 12, biome: BiomeType.Grassland },
  empty: { col: 42, row: 14, biome: BiomeType.TemperateDeciduousForest },
} as const;

/** The picked tile as the right rail draws it, on the sites fixture with its tiles' biomes known. */
const TileLab = ({ tile }: { tile: keyof typeof LAB_TILES }) => {
  useDocumentClass("classic-hud");
  const [store] = useState(() => {
    const store = installFixtureGame(campBeside);
    installBiomes(store);
    const { col, row } = LAB_TILES[tile];
    useUIStore.setState({ selectedHex: { col, row } });
    return store;
  });
  // Drawing a tile calls nothing; its buttons would, so the lab hands them no chain.
  const setup = { store, systemCalls: {} } as unknown as GameClientSetup;
  return (
    <GameProvider value={setup} account={{ address: PLAYER } as never}>
      <div className="flex min-h-screen flex-col items-end bg-[#0b1418] p-6">
        <div data-lab="tile" className="flex w-hud-column flex-col gap-2">
          <SelectedWorldmapEntity />
        </div>
      </div>
    </GameProvider>
  );
};

const installBiomes = (store: NativeFactStore) =>
  store.applyFacts(
    Object.values(LAB_TILES).map(({ col, row, biome }, index) => ({
      model: "TileOpt",
      key: `0x9${index}`,
      value: {
        game_id: 1,
        alt: false,
        col,
        row,
        data: String(BigInt(BiomeTypeToId[biome]) * BigInt(nativeTilePackingConstants.BIOME_SCALE)),
      },
    })) as never,
  );
