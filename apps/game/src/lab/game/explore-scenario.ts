import { getNeighborHexes } from "@bibliothecadao/types";
import { SPIRE_ARMY, SPIRE_ARMY_TILE_KEY } from "@/ui/features/frontier/spire-fixture";

import type { LabScenario } from "./lab-chain";
import { spireScenario } from "./spire-scenario";

/** The army's tile row at the edge, under a key no fixture row uses. */
const EDGE_TILE_KEY = "0x1ac0";

const wire = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? field.toString() : field)));

/**
 * The spire's army at the edge of the land it has seen (/lab/game?scenario=explore): the free revealed tile nearest it
 * with fog beside it, so a tap or a right-click there explores (owner, 27 October 2026: "Yes double tapping to explore
 * on mobile").
 */
export const exploreScenario = (): LabScenario => {
  const spire = spireScenario();
  const { store } = spire;
  const army = store.entityOccupancy(1, SPIRE_ARMY)!;
  const revealed = (hex: { col: number; row: number }) =>
    Boolean(store.get("TileOpt", { game_id: 1, alt: false, col: hex.col, row: hex.row }));
  const taken = new Set([...store.rows("TileOccupancy")].map((tile) => `${tile.col},${tile.row}`));
  const edge = [...store.rows("TileOpt")]
    .filter((tile) => !tile.alt && !taken.has(`${tile.col},${tile.row}`))
    .filter((tile) => getNeighborHexes(tile.col, tile.row).some((hex) => !revealed(hex)))
    .sort((a, b) => distance(a, army) - distance(b, army))[0];
  store.applyFacts([
    { model: "TileOccupancy", key: SPIRE_ARMY_TILE_KEY, value: null },
    { model: "TileOccupancy", key: EDGE_TILE_KEY, value: wire({ ...army, col: edge.col, row: edge.row }) },
  ] as never);
  return spire;
};

const distance = (a: { col: number; row: number }, b: { col: number; row: number }) =>
  Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
