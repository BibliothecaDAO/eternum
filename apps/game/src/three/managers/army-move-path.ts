import { getHexDistance } from "@bibliothecadao/types";

export const resolveMovementPath = <T>(start: T, target: T, workerPath: T[] | null | undefined): T[] => {
  if (!workerPath || workerPath.length < 2) {
    return [start, target];
  }

  return workerPath;
};

/** A tile as the army's walk compares two: its normalized place. */
interface HexPlace {
  getNormalized(): { x: number; y: number };
}

/** The route an army was ordered along, if it runs from where the army stands to where its facts now put it. */
export const orderedRouteFor = <T extends HexPlace>(route: T[] | undefined, from: T, to: T): T[] | null =>
  route && route.length >= 2 && isSameHex(route[0], from) && isSameHex(route[route.length - 1], to) ? route : null;

const isSameHex = (left: HexPlace, right: HexPlace): boolean => {
  const a = left.getNormalized();
  const b = right.getNormalized();
  return a.x === b.x && a.y === b.y;
};

/**
 * Whether the path worker could return a route for this walk: none is shorter than the tiles between its ends, and the
 * worker returns none longer than `maxHex`. A walk past that (into a spire's depth, a region away) is drawn straight,
 * and asking the worker first only delays it.
 */
export const isRoutable = (from: HexPlace, to: HexPlace, maxHex: number): boolean => {
  const [a, b] = [from.getNormalized(), to.getNormalized()];
  return getHexDistance({ col: a.x, row: a.y }, { col: b.x, row: b.y }) <= maxHex;
};
