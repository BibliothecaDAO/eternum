import type { ResolvedGameMode } from "@/config/game-modes/resolved-mode";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

const ARMY_RESOURCE_INVENTORY_TAB_LABEL = "Inventory";

export const shouldShowArmyResourceInventoryTab = (resolvedWorldMode: ResolvedGameMode, resourceStackCount: number) =>
  resolvedWorldMode === "eternum" || resourceStackCount > 0;

type RawTroopCount = bigint | number | null | undefined;

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const formatCompactNumber = (value: number): string => compactNumberFormatter.format(value);

const formatTroopUnit = (troopCount: number): string => (troopCount === 1 ? "troop" : "troops");

const normalizeTroopCount = (rawTroopCount: RawTroopCount): number => {
  if (rawTroopCount === null || rawTroopCount === undefined) return 0;

  if (typeof rawTroopCount === "bigint") {
    return Number(rawTroopCount > 0n ? rawTroopCount / BigInt(RESOURCE_PRECISION) : 0n);
  }

  return Math.max(0, Math.floor(rawTroopCount / RESOURCE_PRECISION));
};

const formatCompactTroopCount = (troopCount: number): string => {
  const flooredTroopCount = Math.max(0, Math.floor(troopCount));

  if (flooredTroopCount < 1_000) {
    return flooredTroopCount.toLocaleString();
  }

  if (flooredTroopCount < 1_000_000) {
    return `${formatCompactNumber(flooredTroopCount / 1_000)}k`;
  }

  return `${formatCompactNumber(flooredTroopCount / 1_000_000)}m`;
};

export const formatArmyTroopCountLabel = (rawTroopCount: RawTroopCount): string => {
  const troopCount = normalizeTroopCount(rawTroopCount);
  return `${troopCount.toLocaleString()} ${formatTroopUnit(troopCount)}`;
};

export const formatArmyCombatTabCue = (rawTroopCount: RawTroopCount): string => {
  const troopCount = normalizeTroopCount(rawTroopCount);
  return formatCompactTroopCount(troopCount);
};
