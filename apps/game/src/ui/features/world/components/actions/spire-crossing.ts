/**
 * The contract moves an army through a spire to its own hex on the other layer, and only if that hex is free.
 * Mirrors `alt_movement_systems::toggle_alternate` so the modal can say why a crossing will not go through.
 */
interface SpireCrossingTile {
  occupier_id: number | bigint;
  occupier_is_structure: boolean;
}

type SpireCrossing =
  | { kind: "clear"; toEthereal: boolean }
  | { kind: "blocked"; toEthereal: boolean; by: "army" | "structure" };

export const resolveSpireCrossing = (
  explorerLayer: boolean,
  destination: SpireCrossingTile | undefined,
): SpireCrossing => {
  const toEthereal = !explorerLayer;
  if (!destination || Number(destination.occupier_id) === 0) return { kind: "clear", toEthereal };
  return { kind: "blocked", toEthereal, by: destination.occupier_is_structure ? "structure" : "army" };
};
