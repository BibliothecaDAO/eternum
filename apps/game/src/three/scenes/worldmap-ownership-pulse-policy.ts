import { type HexPosition } from "@bibliothecadao/types";

export function resolveOwnershipPulseHexes(params: {
  structureHex?: HexPosition | null;
  ownedArmyHexes: Array<HexPosition | null | undefined>;
  extraHexes?: Array<HexPosition | null | undefined>;
  suppressedHexes?: Array<HexPosition | null | undefined>;
}): HexPosition[] {
  const resolved: HexPosition[] = [];
  const seen = new Set<string>();
  const suppressed = new Set(
    (params.suppressedHexes ?? [])
      .filter((hex): hex is HexPosition => Boolean(hex))
      .map((hex) => `${hex.col},${hex.row}`),
  );

  const addHex = (hex: HexPosition | null | undefined) => {
    if (!hex) {
      return;
    }

    const key = `${hex.col},${hex.row}`;
    if (suppressed.has(key) || seen.has(key)) {
      return;
    }

    seen.add(key);
    resolved.push(hex);
  };

  addHex(params.structureHex);
  params.ownedArmyHexes.forEach((hex) => addHex(hex));
  (params.extraHexes ?? []).forEach((hex) => addHex(hex));

  return resolved;
}
