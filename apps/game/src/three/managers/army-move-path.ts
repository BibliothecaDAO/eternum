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
