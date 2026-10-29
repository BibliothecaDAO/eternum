import { formatGain, TileOccupier } from "@bibliothecadao/types";
import { nativeRuleConstants, type NativeRows } from "@bibliothecadao/eternum/game-client";

import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { SHRINE, STAMINA, WELL, XP } from "@/ui/design-system/kit/words";

/**
 * The single-use sites a tile can hold, each by its occupier category (these sites have no Structure), as the map names
 * and paints it: the one list the site's card and a place shared in chat read.
 */
export const MAP_SITES = [
  { kind: "Shrine", occupier: TileOccupier.Shrine, name: SHRINE, icon: "shrine" },
  { kind: "Well", occupier: TileOccupier.Well, name: WELL, icon: "well" },
] as const satisfies readonly { kind: string; occupier: number; name: string; icon: IconMeaning }[];

type MapSite = (typeof MAP_SITES)[number];
export type MapSiteKind = MapSite["kind"];

/** A tile's single-use site, from its occupier category alone. */
export const mapSiteOf = (occupierType: number | undefined): MapSite | null =>
  MAP_SITES.find((site) => site.occupier === occupierType) ?? null;

export const mapSiteKind = (occupierType: number | undefined): MapSiteKind | null =>
  mapSiteOf(occupierType)?.kind ?? null;

export const mapSite = (kind: MapSiteKind): MapSite => MAP_SITES.find((site) => site.kind === kind)!;

/** What one use gives: a Shrine its fixed XP, a Well stamina; unknown while the game's XP rules are. */
export const siteGain = (
  kind: MapSiteKind,
  rules: NativeRows["ArmyProgressionRules"] | undefined,
): number | undefined => (kind === "Shrine" ? rules?.fixed_xp : nativeRuleConstants.WELL_STAMINA);

/**
 * What a use adds to the army, as the hover names it: a Shrine's XP, or the stamina a Well lands, which never rises
 * past the army's maximum. A full bar gains nothing, and the line says the Well would be spent for nothing.
 */
export const siteGainLine = (
  kind: MapSiteKind,
  gain: number | undefined,
  stamina: { current: number; max: number } | undefined,
): string | null => {
  if (gain === undefined) return null;
  if (kind === "Shrine") return `${formatGain(gain)} ${XP}`;
  const lands = stamina ? Math.max(0, Math.min(gain, stamina.max - stamina.current)) : gain;
  if (lands === 0) return `Stamina full: the well would be wasted`;
  return lands < gain ? `${formatGain(lands)} ${STAMINA}, to full` : `${formatGain(gain)} ${STAMINA}`;
};
