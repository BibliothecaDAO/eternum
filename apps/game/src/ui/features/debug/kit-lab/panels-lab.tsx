import { GameProvider, useGame } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { campBeside } from "@/ui/features/frontier/sites/site-fixture";
import { SelectedWorldmapEntity } from "@/ui/features/world/components/actions/selected-worldmap-entity";
import { useSelectedTileDetails } from "@/ui/features/world/components/bottom-right-panel/bottom-right-panel";
import { useDocumentClass } from "@/hooks/use-document-class";
import { installActiveGameClient } from "@/sync/active-game-client";
import { TopHeader } from "@/ui/features/world/containers/top-header/top-header";
import { HoldingsList, useHoldings } from "@/ui/features/world/hud/holdings";
import { LeftColumn, OrdersFoot } from "@/ui/features/world/hud/desktop-hud";
import { HudMinimap } from "@/ui/features/world/hud/minimap";
import { BuildTag } from "@/ui/layouts/build-tag";
import { SurfaceHost } from "@/ui/design-system/molecules/popover";
import { RealmCard } from "@/ui/features/world/hud/realm-card";
import { createGameViews, type GameClient } from "@bibliothecadao/eternum";
import type { GameClientSetup, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import {
  BiomeType,
  BiomeTypeToId,
  BUILDINGS_CENTER,
  BuildingType,
  RESOURCE_PRECISION,
  ResourcesIds,
  StructureType,
  TileOccupier,
} from "@bibliothecadao/types";
import { type ReactNode, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { nativeTilePackingConstants } from "../../../../../../../contracts/l3/world-native/schema/client.gen";
import ROW_SET from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { installBuildingRules, installFixtureGame, PLAYER } from "./fixture-game";

/**
 * Dev only: the Blitz and Eternum HUD's panels as a player sees them, the real components on the deploy fixture's
 * realm in the War room skin, at /lab/kit/panels: the left column (the holdings, the selected realm's card and the
 * minimap; `?holding=rift` makes the realm an Essence Rift), which a spectated game does not show, or the desktop HUD's left column and foot where they sit on the
 * screen with `?part=hud`, or the top bar alone with `?part=top-header` (it selects for the
 * page, so it never shares one with the holdings), or the picked tile alone with `?tile=army|realm|empty` (the sites
 * fixture's army, the realm with a guard and many resources, a bare forest), or the realm view's building panel with
 * `?tile=castle|building|production` (the realm's castle with its level-up, a farm with what it makes, a wood mill
 * with its production to add). Each part carries the `data-lab` mark the HUD captures
 * (scripts/capture-hud-lab.mjs) look for.
 */
export const PanelsLab = () => {
  const [params] = useSearchParams();
  const tile = params.get("tile");
  if (tile === "army" || tile === "empty" || tile === "realm") return <TileLab tile={tile} />;
  if (tile === "castle" || tile === "building" || tile === "production") return <BuildingLab building={tile} />;
  return <ColumnLab />;
};

const ColumnLab = () => {
  useDocumentClass("classic-hud");
  const [params] = useSearchParams();
  const [store] = useState(() => {
    const store = installFixtureGame();
    if (params.get("holding") === "rift") installRift(store);
    return store;
  });
  return (
    <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: PLAYER } as never}>
      <div className="flex min-h-screen flex-col items-start gap-6 bg-[#0b1418] p-6 text-gold">
        {params.get("part") === "hud" ? (
          <HudStage />
        ) : params.get("part") === "top-header" ? (
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

/**
 * The desktop HUD's left side and foot over a stand-in for the map: the real left column (the holdings, the card, the
 * minimap at the bottom left), the order bubbles and the build tag, where they sit at the viewport's size. The right
 * rail reads the live game, so the chat lab draws it instead.
 */
const HudStage = () => {
  const { setup } = useGame();
  useState(() => installBusyRealm(setup.store));
  return (
    <div data-lab="hud" className="fixed inset-0">
      <canvas className="absolute inset-0 h-full w-full bg-[#0b1418]" />
      <LeftColumn />
      <OrdersFoot />
      <BuildTag />
    </div>
  );
};

/**
 * The realm on its tile, three guard slots and one guard of 1,000 T1 knights in them, and nine stores, so its tile panel shows a guard row and
 * more resources than two rows hold.
 */
const installGuardedRealm = (store: NativeFactStore) => {
  const { col, row } = LAB_TILES.realm;
  const stores = [
    ResourcesIds.Labor,
    ResourcesIds.Donkey,
    ResourcesIds.Wheat,
    ResourcesIds.Wood,
    ResourcesIds.Coal,
    ResourcesIds.Ruby,
    ResourcesIds.Knight,
    ResourcesIds.Essence,
    ResourcesIds.Fish,
  ];
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  store.applyFacts([
    { model: "Structure", key: "0x7", value: { ...realm, base: { ...realm.base, troop_max_guard_count: 3 } } },
    {
      model: "TileOccupancy",
      key: "0x9d0",
      value: {
        game_id: 1,
        alt: false,
        col,
        row,
        entity_id: 7,
        category: TileOccupier.RealmRegularLevel1,
        is_structure: true,
      },
    },
    {
      model: "Guard",
      key: "0x9d1",
      value: {
        game_id: 1,
        structure_id: 7,
        slot: 0,
        troops: {
          ...ROW_SET.expected.value.troops,
          count: String(1_000n * BigInt(RESOURCE_PRECISION)),
          stamina: { Inline: { amount: "100", settled_at: "350000", remainder: "0" } },
        },
        destroyed_tick: 0,
      },
    },
    ...stores
      .filter((resource) => !store.get("ResourceBalance", { game_id: 1, entity_id: 7, resource_type: resource }))
      .map((resource, index) => ({
        model: "ResourceBalance",
        key: `0x9e${index}`,
        value: {
          game_id: 1,
          entity_id: 7,
          resource_type: resource,
          balance: String(BigInt(1_000 + 500 * index) * BigInt(RESOURCE_PRECISION)),
        },
      })),
  ] as never);
};

/** The fixture's holding as an Essence Rift: no population or automation, 188 donkeys and 280 Essence held. */
const installRift = (store: NativeFactStore) => {
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  const held = (resource: ResourcesIds, amount: bigint, key: string) => ({
    model: "ResourceBalance",
    key,
    value: { game_id: 1, entity_id: 7, resource_type: resource, balance: String(amount * BigInt(RESOURCE_PRECISION)) },
  });
  store.applyFacts([
    {
      model: "Structure",
      key: "0x7",
      value: {
        ...realm,
        base: { ...realm.base, category: StructureType.Mine },
        metadata: { ...realm.metadata, mine_kind: 1 },
      },
    },
    {
      model: "TileOccupancy",
      key: "0x9c3",
      value: {
        game_id: 1,
        alt: false,
        col: 44,
        row: 12,
        entity_id: 7,
        category: TileOccupier.Mine,
        is_structure: true,
      },
    },
    held(ResourcesIds.Donkey, 188n, "0x9c1"),
    held(ResourcesIds.Essence, 280n, "0x9c2"),
  ] as never);
};

/** The realm a few days in, as the card's widest row reads it: ten of its population used, four plots built. */
const installBusyRealm = (store: NativeFactStore) =>
  store.applyFacts([
    {
      model: "StructureBuildings",
      key: "0x9a0",
      value: {
        game_id: 1,
        entity_id: "7",
        packed_counts_1: "0",
        packed_counts_2: "0",
        packed_counts_3: "0",
        population: { current: 10, max: 6 },
      },
    },
    ...[1, 2, 3, 4].map((offset) => ({
      model: "Building",
      key: `0x9b${offset}`,
      value: {
        game_id: 1,
        structure_id: "7",
        inner_col: BUILDINGS_CENTER[0] + offset,
        inner_row: BUILDINGS_CENTER[1],
        category: BuildingType.ResourceWheat,
        paused: false,
        labor_paid: "0",
      },
    })),
  ] as never);

const LabHoldings = () => {
  const holdings = useHoldings();
  return (
    <>
      <HoldingsList holdings={holdings} />
      <RealmCard holding={holdings.selected} />
    </>
  );
};

/**
 * The lab's tiles: the sites fixture's army (41, 12) on grass, the player's realm with a guard and a full store two
 * hexes off, and a bare forest.
 */
const LAB_TILES = {
  army: { col: 41, row: 12, biome: BiomeType.Grassland },
  realm: { col: 44, row: 12, biome: BiomeType.Grassland },
  empty: { col: 42, row: 14, biome: BiomeType.TemperateDeciduousForest },
} as const;

/**
 * The picked tile as the right rail draws it, on the sites fixture with its tiles' biomes known, with the surface a
 * control on it opens (a guard slot's deploy picker).
 */
const TileLab = ({ tile }: { tile: keyof typeof LAB_TILES }) => {
  useDocumentClass("classic-hud");
  return (
    <TileGame tile={tile}>
      <div className="flex min-h-screen flex-col items-end bg-[#0b1418] p-6">
        <div data-lab="tile" className="flex w-hud-column flex-col gap-2">
          <SelectedWorldmapEntity />
        </div>
      </div>
      <SurfaceHost />
    </TileGame>
  );
};

/** The sites fixture's game with one of the lab's tiles picked, for what draws the picked tile (the chat lab's rail too). */
export const TileGame = ({ tile, children }: { tile: keyof typeof LAB_TILES; children: ReactNode }) => {
  const [store] = useState(() => {
    const store = installFixtureGame(campBeside);
    installBiomes(store);
    installGuardedRealm(store);
    installLabClient(store);
    const { col, row } = LAB_TILES[tile];
    useUIStore.setState({ selectedHex: { col, row } });
    return store;
  });
  // Drawing a tile calls nothing; its buttons would, so the lab hands them no chain.
  const setup = { store, systemCalls: {} } as unknown as GameClientSetup;
  return (
    <GameProvider value={setup} account={{ address: PLAYER } as never}>
      {children}
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
    installLabClient(store);
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

/** A structure's panels read the game through the booted client; the lab's sends nothing, as its tiles call nothing. */
const installLabClient = (store: NativeFactStore) => {
  const client = { setup: { store, systemCalls: {} }, actions: {}, connect() {}, disconnect() {} };
  installActiveGameClient({
    ...client,
    views: createGameViews(client as unknown as GameClient, BigInt(PLAYER), () => null),
  } as unknown as GameClient);
};

const LabBuildingPanel = () => <>{useSelectedTileDetails()}</>;

/**
 * The lab's buildings with what reads them: the game's building rules and wood's recipe (labor in, wood out), the
 * game's commands all on, so a Blitz or Eternum panel's production path is open on the Frontier fixture.
 */
const installBuildings = (store: NativeFactStore) => {
  installBuildingRules(store, [BuildingType.ResourceWood]);
  const rules = store.require("SliceRules", { game_id: 1 });
  store.applyFacts([
    { model: "SliceRules", key: "0x100", value: { ...rules, command_mask: String((1n << 64n) - 1n) } },
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
