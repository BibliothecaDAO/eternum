/**
 * The contract moves an army through a spire to its own hex on the other layer, and only if that hex is free.
 * Mirrors the native alternate movement command so the modal can say why a crossing will not go through.
 */
interface SpireCrossingTile {
  occupier_id: number | bigint;
  occupier_is_structure: boolean;
}

type SpireCrossing =
  | { kind: "unknown" }
  | { kind: "clear"; toEthereal: boolean }
  | { kind: "blocked"; toEthereal: boolean; by: "army" | "structure" };

// An army whose occupancy this client cannot see has no known layer, so neither side of the spire is known.
export const resolveSpireCrossing = (
  explorerLayer: boolean | undefined,
  destination: SpireCrossingTile | undefined,
): SpireCrossing => {
  if (explorerLayer === undefined) return { kind: "unknown" };
  const toEthereal = !explorerLayer;
  if (!destination || Number(destination.occupier_id) === 0) return { kind: "clear", toEthereal };
  return { kind: "blocked", toEthereal, by: destination.occupier_is_structure ? "structure" : "army" };
};
