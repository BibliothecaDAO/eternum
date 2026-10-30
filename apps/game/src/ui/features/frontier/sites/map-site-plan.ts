import { formatGain, skillPointName } from "@bibliothecadao/types";
import { nativeRuleConstants, type NativeRows } from "@bibliothecadao/eternum/game-client";

import { type MapSiteKind, mapSiteOf } from "@/config/map-sites";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { SHRINE, STAMINA, WELL } from "@/ui/design-system/kit/words";

export type { MapSiteKind } from "@/config/map-sites";

/** How the HUD names and paints each site of the map's catalog (MAP_SITES), the site card and chat alike. */
const SITE_FACES: Record<MapSiteKind, { name: string; icon: IconMeaning }> = {
  Shrine: { name: SHRINE, icon: "shrine" },
  Well: { name: WELL, icon: "well" },
};

export const mapSiteKind = (occupierType: number | undefined): MapSiteKind | null =>
  mapSiteOf(occupierType)?.kind ?? null;

/** A site of the map's catalog as the HUD names and paints it. */
export const mapSite = (kind: MapSiteKind) => ({ kind, ...SITE_FACES[kind] });

/** A Shrine's stored discovery rank; a Well's fixed refill. */
export const siteGain = (kind: MapSiteKind, reward: NativeRows["ShrineReward"] | undefined): number | undefined => {
  if (kind === "Well") return nativeRuleConstants.WELL_STAMINA;
  if (!reward) return undefined;
  skillPointName(reward.rank);
  return reward.rank;
};

export const siteGainLine = (
  kind: MapSiteKind,
  gain: number | undefined,
  stamina: { current: number; max: number } | undefined,
): string | null => {
  if (gain === undefined) return null;
  if (kind === "Shrine") return skillPointName(gain);
  const lands = stamina ? Math.max(0, Math.min(gain, stamina.max - stamina.current)) : gain;
  if (lands === 0) return `Stamina full: the well would be wasted`;
  return lands < gain ? `${formatGain(lands)} ${STAMINA}, to full` : `${formatGain(gain)} ${STAMINA}`;
};
