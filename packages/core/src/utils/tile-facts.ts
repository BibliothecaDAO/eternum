import type { ID, Tile } from "@bibliothecadao/types";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";

type TileKey = Pick<NativeRows["TileOpt"], "alt" | "col" | "row">;

/** Terrain and occupancy are independent facts; an unrevealed occupied tile has biome zero. */
export function tileFactsToTile(
  key: TileKey,
  terrain: Pick<NativeRows["TileOpt"], "data"> | undefined,
  occupancy: Pick<NativeRows["TileOccupancy"], "entity_id" | "category" | "is_structure"> | undefined,
): Tile | undefined {
  if (!terrain && !occupancy) return undefined;
  return {
    ...key,
    biome: terrain ? Number((terrain.data >> 41n) & 0xffn) : 0,
    reward_extracted: terrain ? ((terrain.data >> 113n) & 1n) !== 0n : false,
    occupier_id: (occupancy?.entity_id ?? 0) as ID,
    occupier_type: occupancy?.category ?? 0,
    occupier_is_structure: occupancy?.is_structure ?? false,
  };
}
