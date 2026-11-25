import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { armyBar } from "@/ui/features/frontier/hud/dock-armies";
import { armyOaths, oathWellStamina } from "@bibliothecadao/eternum";
import { nativeOathConstants as oaths, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { getNeighborHexes, TileOccupier } from "@bibliothecadao/types";

import { type LabCommand, type LabFact, type LabScenario, wire } from "./lab-chain";
import { armySpent, spireScenario } from "./spire-scenario";

type Hex = { col: number; row: number };

const SITES = [
  { occupier: TileOccupier.Shrine, entity: 9401, key: "0x5401" },
  { occupier: TileOccupier.Well, entity: 9402, key: "0x5402" },
] as const;

const OFFERED_PICK = oaths.POWER - 1 + ((oaths.FOX - 1) << 4) + ((oaths.RAGE - 1) << 8);

export const mapSitesScenario = (): LabScenario => {
  const spire = spireScenario();
  const { store } = spire;
  const stands = store.entityOccupancy(1, SPIRE_ARMY)!;
  const open = openTilesBeside(store, stands);
  store.applyFacts(
    SITES.map((site, index) => ({
      model: "TileOccupancy",
      key: site.key,
      value: wire({
        game_id: 1,
        alt: false,
        ...open[index]!,
        entity_id: site.entity,
        category: site.occupier,
        is_structure: false,
      }),
    })) as never,
  );
  return {
    ...spire,
    answer: (command, chain, now) =>
      command.kind === "InteractSite" ? answerSiteUse(command, chain, now) : spire.answer(command, chain, now),
  };
};

const openTilesBeside = (store: NativeFactStore, beside: Hex): Hex[] => {
  const taken = new Set([...store.entries("TileOccupancy")].map(([, row]) => `${row.col},${row.row}`));
  const open = getNeighborHexes(beside.col, beside.row).filter(
    (hex) =>
      !taken.has(`${hex.col},${hex.row}`) && store.get("TileOpt", { game_id: 1, alt: false, col: hex.col, row: hex.row }),
  );
  if (open.length < SITES.length) throw new Error("The lab finds no two open tiles beside the spire's army");
  return open.slice(0, SITES.length).map(({ col, row }) => ({ col, row }));
};

const answerSiteUse = (command: LabCommand, chain: NativeFactStore, now: number): LabFact[] => {
  const [rawId, alt, x, y] = command.span.slice(1);
  if (rawId === undefined || alt === undefined || x === undefined || y === undefined) return [];
  const explorerId = BigInt(rawId);
  const tile = { game_id: 1, alt: BigInt(alt) !== 0n, col: Number(x), row: Number(y) };
  const site = chain.get("TileOccupancy", tile);
  const kind = SITES.find((candidate) => candidate.occupier === Number(site?.category));
  if (!site || !kind) return [];
  const army = chain.require("ExplorerTroops", { game_id: 1, explorer_id: explorerId });
  const gone: LabFact = { model: "TileOccupancy", key: chain.wireKeyOf("TileOccupancy", tile)!, value: null };
  if (kind.occupier === TileOccupier.Well) {
    const bar = armyBar(chain, army, now).stamina!;
    const granted = Math.min(oathWellStamina(armyOaths(chain, army), bar.max), bar.max - bar.current);
    return [gone, armySpent(chain, explorerId, -granted, now), siteUsed(chain, army, tile, { Well: granted }, now)];
  }
  const progress = chain.require("ArmyProgress", { game_id: 1, explorer_id: explorerId });
  return [
    gone,
    { model: "ArmyProgress", key: chain.wireKeyOf("ArmyProgress", progress)!, value: wire({ ...progress, oath_pick: OFFERED_PICK }) },
    siteUsed(chain, army, tile, { Shrine: 0 }, now),
  ];
};

const siteUsed = (
  chain: NativeFactStore,
  army: NativeRows["ExplorerTroops"],
  tile: { alt: boolean; col: number; row: number },
  benefit: { Well: number } | { Shrine: number },
  now: number,
): LabFact => ({
  model: "StoryEvent",
  key: `site-used-${tile.col}-${tile.row}`,
  value: wire({
    version: 1,
    game_id: 1,
    owner: chain.require("Structure", { game_id: 1, entity_id: army.owner }).owner,
    entity_id: army.owner,
    tx_hash: "0x0",
    story: { SiteUsed: { explorer_id: army.explorer_id, coord: { alt: tile.alt, x: tile.col, y: tile.row }, benefit } },
    timestamp: now,
  }),
});
