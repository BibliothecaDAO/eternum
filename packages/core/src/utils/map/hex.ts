/**
 * Hexagonal coordinate system implementation
 * Based on https://www.redblobgames.com/grids/hexagons/
 */

import { TileOccupier } from "@bibliothecadao/types";

type TileOccupantKind = "none" | "structure" | "reserved-hyperstructure" | "army" | "chest" | "spire" | "map-site";

/** What stands on a tile, for every occupier the contract names: a new id does not compile until it is placed here. */
const TILE_OCCUPANT_KINDS: Record<TileOccupier, TileOccupantKind> = {
  [TileOccupier.None]: "none",
  [TileOccupier.RealmRegularLevel1]: "structure",
  [TileOccupier.RealmRegularLevel2]: "structure",
  [TileOccupier.RealmRegularLevel3]: "structure",
  [TileOccupier.RealmRegularLevel4]: "structure",
  [TileOccupier.RealmWonderLevel1]: "structure",
  [TileOccupier.RealmWonderLevel2]: "structure",
  [TileOccupier.RealmWonderLevel3]: "structure",
  [TileOccupier.RealmWonderLevel4]: "structure",
  [TileOccupier.Hyperstructure]: "structure",
  [TileOccupier.Mine]: "structure",
  [TileOccupier.Village]: "structure",
  [TileOccupier.Bank]: "structure",
  [TileOccupier.ExplorerKnightT1]: "army",
  [TileOccupier.ExplorerKnightT2]: "army",
  [TileOccupier.ExplorerKnightT3]: "army",
  [TileOccupier.ExplorerPaladinT1]: "army",
  [TileOccupier.ExplorerPaladinT2]: "army",
  [TileOccupier.ExplorerPaladinT3]: "army",
  [TileOccupier.ExplorerCrossbowmanT1]: "army",
  [TileOccupier.ExplorerCrossbowmanT2]: "army",
  [TileOccupier.ExplorerCrossbowmanT3]: "army",
  [TileOccupier.Chest]: "chest",
  [TileOccupier.Spire]: "spire",
  [TileOccupier.Camp]: "structure",
  [TileOccupier.BitcoinMine]: "structure",
  [TileOccupier.ReservedHyperstructure]: "reserved-hyperstructure",
  [TileOccupier.Shrine]: "map-site",
  [TileOccupier.Well]: "map-site",
  [TileOccupier.Rift]: "structure",
  [TileOccupier.Ruin]: "structure",
  [TileOccupier.Stragglers]: "structure",
};

const tileOccupantKind = (tileOccupier: number): TileOccupantKind | undefined =>
  TILE_OCCUPANT_KINDS[tileOccupier as TileOccupier];

/** A structure tile, counting a hyperstructure site reserved before it is built. */
export const isTileOccupierStructure = (tileOccupier: TileOccupier) => {
  const kind = tileOccupantKind(tileOccupier);
  return kind === "structure" || kind === "reserved-hyperstructure";
};

export const isTileOccupierArmy = (tileOccupier: number) => tileOccupantKind(tileOccupier) === "army";

/** A shrine or well: a single-use tile object with no Structure, which no army may enter. */
export const isTileOccupierMapSite = (tileOccupier: number) => tileOccupantKind(tileOccupier) === "map-site";

export const isTileOccupierChest = (tileOccupier: TileOccupier) => {
  return tileOccupantKind(tileOccupier) === "chest";
};

export const isTileOccupierReservedHyperstructure = (tileOccupier: TileOccupier) => {
  return tileOccupantKind(tileOccupier) === "reserved-hyperstructure";
};

export const hasTileOccupier = (tileOccupier: number | null | undefined) => {
  return Number(tileOccupier ?? TileOccupier.None) !== TileOccupier.None;
};
