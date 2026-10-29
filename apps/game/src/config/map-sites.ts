import { TileOccupier } from "@bibliothecadao/types";

/**
 * The single-use sites a map tile can hold: no Structure, so the tile's occupier category alone names and places one.
 * The one catalog of them: the renderer draws each (its model), the minimap marks each, the site card and chat name and
 * paint each, every one keyed by `kind` exhaustively, so a site added here is a type error wherever it is not yet drawn,
 * marked, named or painted.
 */
export const MAP_SITES = [
  { kind: "Shrine", occupier: TileOccupier.Shrine },
  { kind: "Well", occupier: TileOccupier.Well },
] as const;

export type MapSite = (typeof MAP_SITES)[number];
export type MapSiteKind = MapSite["kind"];

/** A tile's single-use site, from its occupier category alone; none for any other occupier. */
export const mapSiteOf = (occupierType: number | undefined): MapSite | null =>
  MAP_SITES.find((site) => site.occupier === occupierType) ?? null;
