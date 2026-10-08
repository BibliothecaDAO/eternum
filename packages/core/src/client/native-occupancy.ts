import { TileOccupier } from "@bibliothecadao/types";

type Scalar = number | bigint | string;

/** Mirrors MapState::has_single_position: chests, spires and reservations have tile-only identities. */
export function hasSingleTilePosition(occupancy: { entity_id: Scalar; category: Scalar }): boolean {
  return (
    BigInt(occupancy.entity_id) !== 0n &&
    Number(occupancy.category) !== TileOccupier.Chest &&
    Number(occupancy.category) !== TileOccupier.Spire
  );
}
