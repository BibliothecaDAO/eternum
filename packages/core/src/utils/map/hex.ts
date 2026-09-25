/**
 * Hexagonal coordinate system implementation
 * Based on https://www.redblobgames.com/grids/hexagons/
 */

import { TileOccupier } from "@bibliothecadao/types";

export const isTileOccupierStructure = (tileOccupier: TileOccupier) => {
  return (
    tileOccupier === TileOccupier.ReservedHyperstructure ||
    tileOccupier === TileOccupier.RealmRegularLevel1 ||
    tileOccupier === TileOccupier.RealmWonderLevel1 ||
    tileOccupier === TileOccupier.Hyperstructure ||
    tileOccupier === TileOccupier.RealmRegularLevel2 ||
    tileOccupier === TileOccupier.RealmWonderLevel2 ||
    tileOccupier === TileOccupier.RealmRegularLevel3 ||
    tileOccupier === TileOccupier.RealmWonderLevel3 ||
    tileOccupier === TileOccupier.RealmRegularLevel4 ||
    tileOccupier === TileOccupier.RealmWonderLevel4 ||
    tileOccupier === TileOccupier.Mine ||
    tileOccupier === TileOccupier.Village ||
    tileOccupier === TileOccupier.Bank ||
    tileOccupier === TileOccupier.Camp ||
    tileOccupier === TileOccupier.BitcoinMine
  );
};

export const isTileOccupierChest = (tileOccupier: TileOccupier) => {
  return tileOccupier === TileOccupier.Chest;
};

export const isTileOccupierReservedHyperstructure = (tileOccupier: TileOccupier) => {
  return tileOccupier === TileOccupier.ReservedHyperstructure;
};

export const hasTileOccupier = (tileOccupier: number | null | undefined) => {
  return Number(tileOccupier ?? TileOccupier.None) !== TileOccupier.None;
};
