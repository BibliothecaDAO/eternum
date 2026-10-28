import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { expeditionSpireTile, readExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { getHexDistance, getHexesWithinRadius } from "@bibliothecadao/types";

import { clearedCampAt } from "./after-battle-scenario";
import { type LabScenario, wire } from "./lab-chain";
import { spireScenario } from "./spire-scenario";

/** The realm's second army, standing on a camp it cleared. */
const SECOND_ARMY = 203;
/** The camp cleared with nobody on it. */
const EMPTY_CAMP = 712;

/**
 * Two camps the realm's armies cleared, away from its spire (/lab/game?scenario=cleared-camp): the realm's second army
 * stands on one, the other is its cleared standard alone. The owner's phone met both on 28 October 2026: "when I click
 * on a tile that was cleared but an army is standing on it, army panel must be displayed not the cleared one"; "we dont
 * need to put the flag labels on the map it overcrowds it a bit and there's already a flag on the tile".
 */
export const clearedCampScenario = (): LabScenario => {
  const spire = spireScenario();
  const { store } = spire;
  const first = store.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  const [, occupancy] = [...store.entries("TileOccupancy")].find(([, row]) => row.entity_id === BigInt(SPIRE_ARMY))!;
  const [held, empty] = campTiles(store, spire.opensOn, spire.startsAt);
  store.applyFacts([
    { model: "ExplorerTroops", key: "0x1ab97", value: wire({ ...first, explorer_id: SECOND_ARMY }) },
    { model: "TileOccupancy", key: "0x1ab98", value: wire({ ...occupancy, ...held, entity_id: SECOND_ARMY }) },
    clearedCampAt(held),
    clearedCampAt(empty, { key: "0x1ab99", entityId: EMPTY_CAMP }),
  ] as never);
  return spire;
};

/**
 * Two revealed, empty tiles of the realm's land two or more tiles from its spire and from each other: an army there is
 * not at its spire, whose card would stand for it.
 */
const campTiles = (store: NativeFactStore, site: { col: number; row: number }, now: number) => {
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  const spireTile = expeditionSpireTile(readExpeditionRules(store, 1)!, realm, now)!;
  const taken = [...store.entries("TileOccupancy")].map(([, row]) => ({ col: row.col, row: row.row }));
  const open = getHexesWithinRadius(site.col, site.row, 4).filter(
    (hex) =>
      store.get("TileOpt", { game_id: 1, alt: false, col: hex.col, row: hex.row }) &&
      [spireTile, ...taken].every((other) => getHexDistance(hex, other) >= 2),
  );
  const held = open[0];
  const empty = open.find((hex) => getHexDistance(hex, held) >= 2);
  if (!held || !empty) throw new Error("The lab finds no open land away from the spire for two cleared camps");
  return [held, empty].map(({ col, row }) => ({ col, row }));
};
