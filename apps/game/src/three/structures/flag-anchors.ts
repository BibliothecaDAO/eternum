export interface FlagAnchor {
  top: readonly [number, number, number];
  width: number;
  facing: number;
}

const isFiniteList = (value: unknown, length: number): value is number[] =>
  Array.isArray(value) && value.length === length && value.every((entry) => Number.isFinite(entry));

function isFlagAnchor(anchor: unknown): anchor is FlagAnchor {
  const candidate = anchor as Partial<FlagAnchor> | null | undefined;
  return (
    candidate !== null &&
    typeof candidate === "object" &&
    Object.keys(candidate).sort().join() === "facing,top,width" &&
    isFiniteList(candidate.top, 3) &&
    Number.isFinite(candidate.width) &&
    candidate.width! > 0 &&
    Number.isFinite(candidate.facing)
  );
}

export function requireFlagAnchors(anchors: unknown, where: string): FlagAnchor[] {
  if (!Array.isArray(anchors)) throw new Error(`Flag anchors must be a list in ${where}`);
  for (const anchor of anchors) {
    if (!isFlagAnchor(anchor)) {
      throw new Error(`A flag anchor is a banner's top [x,y,z], its width and its facing, nothing else, in ${where}`);
    }
  }
  return anchors;
}
