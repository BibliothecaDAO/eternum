import { formatGain } from "@bibliothecadao/types";
import { nativeRuleConstants } from "@bibliothecadao/eternum/game-client";

import { type MapSiteKind, mapSiteOf } from "@/config/map-sites";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { SHRINE, SITE_USE_WORDS, STAMINA, WELL, wellRefillShare } from "@/ui/design-system/kit/words";

export type { MapSiteKind } from "@/config/map-sites";

const SITE_FACES: Record<MapSiteKind, { name: string; icon: IconMeaning }> = {
  Shrine: { name: SHRINE, icon: "shrine" },
  Well: { name: WELL, icon: "well" },
};

export const mapSiteKind = (occupierType: number | undefined): MapSiteKind | null =>
  mapSiteOf(occupierType)?.kind ?? null;

export const mapSite = (kind: MapSiteKind) => ({ kind, ...SITE_FACES[kind] });

export const wellRefillLands = (gain: number, stamina: { current: number; max: number }): number =>
  Math.max(0, Math.min(gain, stamina.max - stamina.current));

export const siteGainLine = (
  kind: MapSiteKind,
  gain: number | undefined,
  stamina: { current: number; max: number } | undefined,
): string => {
  if (kind === "Shrine") return SITE_USE_WORDS.shrineGives;
  if (gain === undefined || !stamina) return `${wellRefillShare(nativeRuleConstants.WELL_REFILL_PERCENT)} ${STAMINA}`;
  const lands = wellRefillLands(gain, stamina);
  if (lands === 0) return SITE_USE_WORDS.wellWasted;
  return lands < gain ? SITE_USE_WORDS.wellToFull(formatGain(lands)) : `${formatGain(gain)} ${STAMINA}`;
};
