import { GameProvider } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { campBeside } from "@/ui/features/frontier/sites/site-fixture";
import { SelectedWorldmapEntity } from "@/ui/features/world/components/actions/selected-worldmap-entity";
import { useSelectedTileDetails } from "@/ui/features/world/components/bottom-right-panel/bottom-right-panel";
import { useDocumentClass } from "@/hooks/use-document-class";
import { installActiveGameClient } from "@/sync/active-game-client";
import { TopHeader } from "@/ui/features/world/containers/top-header/top-header";
import { HoldingsList, useHoldings } from "@/ui/features/world/hud/holdings";
import { HudMinimap } from "@/ui/features/world/hud/minimap";
import { RealmCard } from "@/ui/features/world/hud/realm-card";
import { createGameViews, type GameClient } from "@bibliothecadao/eternum";
import type { GameClientSetup, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { BiomeType, BiomeTypeToId, BUILDINGS_CENTER, BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { nativeTilePackingConstants } from "../../../../../../../contracts/l3/world-native/schema/client.gen";
import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { installFixtureGame, PLAYER } from "./fixture-game";

/**
 * Dev only: the Blitz and Eternum HUD's panels as a player sees them, the real components on the deploy fixture's
 * realm in the War room skin, at /lab/kit/panels: the left column (the holdings, the selected realm's card and the
 * minimap), which a spectated game does not show, or the top bar alone with `?part=top-header` (it selects for the
 * page, so it never shares one with the holdings), or the picked tile alone with `?tile=army|empty` (the sites
 * fixture's army beside its camp, a bare forest), or the realm view's building panel with
 * `?tile=castle|building|production` (the realm's castle with its level-up, a farm with what it makes, a wood mill
 * with its production to add). Each part carries the `data-lab` mark the HUD captures
 * (scripts/capture-hud-lab.mjs) look for.
 */
export const PanelsLab = () => {
  const [params] = useSearchParams();
  const tile = params.get("tile");
  if (tile === "army" || tile === "empty") return <TileLab tile={tile} />;
  if (tile === "castle" || tile === "building" || tile === "production") return <BuildingLab building={tile} />;
  return <ColumnLab />;
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

/**
 * The realm's inner hexes the building lab picks: its castle at the centre, a farm (which makes food, so it takes no
 * added production) and a wood mill (whose production the panel lets the player add to) around it.
 */
const LAB_BUILDINGS = {
  castle: { innerCol: BUILDINGS_CENTER[0], innerRow: BUILDINGS_CENTER[1] },
  building: { innerCol: BUILDINGS_CENTER[0] + 1, innerRow: BUILDINGS_CENTER[1], category: BuildingType.ResourceWheat },
  production: { innerCol: BUILDINGS_CENTER[0] - 1, innerRow: BUILDINGS_CENTER[1], category: BuildingType.ResourceWood },
} as const;

/** The realm view's building panel, as the right rail draws it off the map, on the fixture realm with its buildings. */
const BuildingLab = ({ building }: { building: keyof typeof LAB_BUILDINGS }) => {
  useDocumentClass("classic-hud");
  const [store] = useState(() => {
    const store = installFixtureGame();
    installBuildings(store);
    // The building panel reads the game through the booted client; the lab's sends nothing, as its tiles call nothing.
    const client = { setup: { store, systemCalls: {} }, actions: {}, connect() {}, disconnect() {} };
    installActiveGameClient({
      ...client,
      views: createGameViews(client as unknown as GameClient, BigInt(PLAYER), () => null),
    } as unknown as GameClient);
    const { innerCol, innerRow } = LAB_BUILDINGS[building];
    useUIStore.setState({ selectedHex: null, selectedBuildingHex: { structureId: 7, innerCol, innerRow } });
    return store;
  });
  const setup = { store, systemCalls: {} } as unknown as GameClientSetup;
  return (
    <GameProvider value={setup} account={{ address: PLAYER } as never}>
      <div className="flex min-h-screen flex-col items-end bg-[#0b1418] p-6">
        <div data-lab="tile" className="flex w-hud-column flex-col gap-2">
          <LabBuildingPanel />
        </div>
      </div>
    </GameProvider>
  );
};

const LabBuildingPanel = () => <>{useSelectedTileDetails()}</>;

/**
 * The lab's buildings with what reads them: the preset's building rules, wood's recipe (labor in, wood out), and the
 * game's commands all on, so a Blitz or Eternum panel's production path is open on the Frontier fixture.
 */
const installBuildings = (store: NativeFactStore) => {
  const rules = store.require("SliceRules", { game_id: 1 });
  store.applyFacts([
    { model: "SliceRules", key: "0x100", value: { ...rules, command_mask: String((1n << 64n) - 1n) } },
    ...preset.buildings.map(({ category, rule }) => ({
      model: "BuildingRule",
      key: `0x6${category}`,
      value: { ...rule, category, game_id: 1 },
    })),
    {
      model: "ProductionRecipe",
      key: "0x9e",
      value: {
        game_id: 1,
        resource_type: ResourcesIds.Wood,
        simple_output: "1000000000",
        complex_output: "1000000000",
        simple_inputs: [{ resource_type: ResourcesIds.Labor, amount: "1000000000" }],
        complex_inputs: [],
      },
    },
    ...[LAB_BUILDINGS.building, LAB_BUILDINGS.production].map(({ innerCol, innerRow, category }, index) => ({
      model: "Building",
      key: `0x9f${index}`,
      value: {
        game_id: 1,
        structure_id: "7",
        inner_col: innerCol,
        inner_row: innerRow,
        category,
        paused: false,
        labor_paid: "0",
      },
    })),
  ] as never);
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
