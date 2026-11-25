import { TileOccupier } from "@bibliothecadao/types";

export const MAP_SITES = [
  { kind: "Shrine", occupier: TileOccupier.Shrine },
  { kind: "Well", occupier: TileOccupier.Well },
] as const;

export type MapSite = (typeof MAP_SITES)[number];
export type MapSiteKind = MapSite["kind"];

export const mapSiteOf = (occupierType: number | undefined): MapSite | null =>
  MAP_SITES.find((site) => site.occupier === occupierType) ?? null;
