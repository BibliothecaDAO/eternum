import { nativeRuleConstants, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { getLayerNeighborHexes, TileOccupier } from "@bibliothecadao/types";
import { MAP_SITE_ART } from "./site-art";

export type MapSiteKind = keyof typeof MAP_SITE_ART;

/** A tile's single-use site, from its occupier category alone: these sites have no Structure. */
export const mapSiteKind = (occupierType: number | undefined): MapSiteKind | null =>
  occupierType === TileOccupier.Shrine ? "Shrine" : occupierType === TileOccupier.Well ? "Well" : null;

/** The player's selected army, where it stands and its progress, when it could use a site. */
export interface MapSiteUser {
  army: NativeRows["ExplorerTroops"];
  armyTile: { col: number; row: number; alt: boolean };
  progress: NativeRows["ArmyProgress"] | undefined;
}

interface MapSitePlan {
  kind: MapSiteKind;
  art: string;
  /** What using it gives: a Shrine its fixed XP, a Well stamina; unknown while the game's XP rules are. */
  gain: number | undefined;
  usable: boolean;
}

/**
 * A Shrine or Well as its tile card shows it: its art, what one use gives, and whether the selected army can use it
 * now. The contract's own refusals disable it first: a living army on an adjacent tile. Unknown progress keeps a Shrine
 * disabled, since its XP lands on the army's progress.
 */
export const readMapSite = (
  kind: MapSiteKind,
  siteTile: { col: number; row: number; alt: boolean },
  user: MapSiteUser | null,
  rules: NativeRows["ArmyProgressionRules"] | undefined,
): MapSitePlan => ({
  kind,
  art: MAP_SITE_ART[kind],
  gain: kind === "Shrine" ? rules?.fixed_xp : nativeRuleConstants.WELL_STAMINA,
  usable: user !== null && canUse(kind, siteTile, user),
});

const canUse = (kind: MapSiteKind, siteTile: { col: number; row: number; alt: boolean }, user: MapSiteUser): boolean =>
  user.army.troops.count > 0n &&
  isAdjacent(user.armyTile, siteTile) &&
  (kind === "Well" || user.progress !== undefined);

const isAdjacent = (army: MapSiteUser["armyTile"], site: { col: number; row: number; alt: boolean }): boolean =>
  army.alt === site.alt &&
  getLayerNeighborHexes(site.col, site.row, site.alt).some((hex) => hex.col === army.col && hex.row === army.row);
