import type { ID, Tile } from "@bibliothecadao/types";
import { nativeTilePackingConstants, type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";

const BIOME_SCALE = BigInt(nativeTilePackingConstants.BIOME_SCALE);
const BYTE_RANGE = BigInt(nativeTilePackingConstants.BYTE_RANGE);
const REWARD_EXTRACTED_FLAG = BigInt(nativeTilePackingConstants.REWARD_EXTRACTED_FLAG);

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
    biome: terrain ? Number((terrain.data / BIOME_SCALE) % BYTE_RANGE) : 0,
    reward_extracted: terrain ? (terrain.data & REWARD_EXTRACTED_FLAG) !== 0n : false,
    occupier_id: (occupancy?.entity_id ?? 0) as ID,
    occupier_type: occupancy?.category ?? 0,
    occupier_is_structure: occupancy?.is_structure ?? false,
  };
}
