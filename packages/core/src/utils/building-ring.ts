import { getHexDistance, getNeighborOffsets } from "@bibliothecadao/types";
import { hash } from "starknet";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";

/**
 * Frontier's marked plot, one per ring of the realm board, exactly as building_ring.cairo derives it: Poseidon of the
 * realm trait id and the ring picks an index around the ring, counted from the east vertex (10 + ring, 10) by walking
 * the literal directions [2, 3, 4, 5, 0, 1], ring steps each. Nothing about it is stored or changes with the day.
 */
const CENTRE = { col: 10, row: 10 };
const WALK = [2, 3, 4, 5, 0, 1] as const;

/** One step on the realm board: the shared neighbour table, the contract's geometry::neighbor at stride one. */
const step = (plot: { col: number; row: number }, direction: number) => {
  const offset = getNeighborOffsets(plot.row).find((candidate) => candidate.direction === direction);
  if (!offset) throw new Error(`Invalid direction ${direction}`);
  return { col: plot.col + offset.i, row: plot.row + offset.j };
};

export const markedPlot = (realmId: number, ring: number): { col: number; row: number } => {
  if (realmId <= 0 || ring <= 0) throw new Error("A marked plot needs a realm and a ring from one");
  const index = Number(BigInt(hash.computePoseidonHashOnElements([realmId, ring])) % BigInt(6 * ring));
  let plot = { col: CENTRE.col + ring, row: CENTRE.row };
  for (let walked = 0; walked < index; walked += 1) plot = step(plot, WALK[Math.floor(walked / ring)]!);
  return plot;
};

/** Whether a plot of the realm board is its ring's marked plot, where a building makes twice its output. */
export const isMarkedPlot = (realmId: number, plot: { col: number; row: number }): boolean => {
  const ring = getHexDistance(CENTRE, plot);
  if (ring === 0 || !Number.isFinite(ring)) return false;
  const marked = markedPlot(realmId, ring);
  return marked.col === plot.col && marked.row === plot.row;
};

/** A realm's marked plot counts only on a realm board: the games whose rules carry one. */
export const isRealmMarkedPlot = (
  store: Pick<NativeFactStore, "get">,
  realm: NativeRows["Structure"],
  plot: { col: number; row: number },
): boolean =>
  store.get("BoardRules", { game_id: realm.game_id }) !== undefined && isMarkedPlot(realm.metadata.realm_id, plot);
