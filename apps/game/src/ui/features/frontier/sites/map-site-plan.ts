import { formatGain, TileOccupier } from "@bibliothecadao/types";
import { nativeRuleConstants, type NativeRows } from "@bibliothecadao/eternum/game-client";

import { STAMINA, XP } from "@/ui/design-system/kit/words";

/** The single-use sites a tile can hold. */
export type MapSiteKind = "Shrine" | "Well";

/** A tile's single-use site, from its occupier category alone: these sites have no Structure. */
export const mapSiteKind = (occupierType: number | undefined): MapSiteKind | null =>
  occupierType === TileOccupier.Shrine ? "Shrine" : occupierType === TileOccupier.Well ? "Well" : null;

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
