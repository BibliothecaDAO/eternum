import type { LucideIcon } from "lucide-react";
import ArrowUpCircle from "lucide-react/dist/esm/icons/arrow-up-circle";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import ChevronsUp from "lucide-react/dist/esm/icons/chevrons-up";
import Factory from "lucide-react/dist/esm/icons/factory";
import Pickaxe from "lucide-react/dist/esm/icons/pickaxe";
import Shield from "lucide-react/dist/esm/icons/shield";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";

/**
 * Suggestion descriptors emitted by the engine. The Overview facet renders
 * the top N as action chips so the column answers "what should I do next?"
 * instead of just "here's what's happening".
 */
export interface SuggestionDescriptor {
  id: string;
  label: string;
  icon: LucideIcon;
  reason?: string;
  /** Render the first 1-2 suggestions with primary emphasis; the rest secondary. */
  emphasis: "primary" | "secondary";
  onClick: () => void;
  disabled?: boolean;
}

export interface SuggestionEngineInput {
  isMine: boolean;
  isRealm: boolean;
  canUpgrade: boolean;
  canProvision: boolean;
  canUpgradeAndProvision: boolean;
  nextLevelName: string | null;
  isUpgradeOrProvisionPending: boolean;
  occupiedGuardSlots: number;
  guardSlotsMax: number;
  productionActive: number;
  productionTotal: number;
  hasPausedProduction: boolean;
  populationCurrent?: number;
  populationMax?: number;
  onUpgradeAndProvision: () => void;
  onUpgrade: () => void;
  onProvision: () => void;
  onOpenMilitary: () => void;
  onOpenEconomy: () => void;
  onOpenConstruction: () => void;
  onOpenProductionModal: () => void;
}

const MAX_SUGGESTIONS = 3;

/**
 * Returns up to {@link MAX_SUGGESTIONS} prioritized suggestions for the given
 * structure state. Pure — no side effects, no hooks. Callers wire up the
 * action callbacks before invoking.
 */
export const buildSuggestions = (input: SuggestionEngineInput): SuggestionDescriptor[] => {
  if (!input.isMine) return [];

  const all: SuggestionDescriptor[] = [];

  if (input.canUpgradeAndProvision) {
    all.push({
      id: "upgrade-and-provision",
      label: input.nextLevelName ? `Upgrade → ${input.nextLevelName} + provision` : "Upgrade & provision",
      icon: ChevronsUp,
      reason: "One signature handles both.",
      emphasis: "primary",
      onClick: input.onUpgradeAndProvision,
      disabled: input.isUpgradeOrProvisionPending,
    });
  } else if (input.canUpgrade) {
    all.push({
      id: "upgrade",
      label: input.nextLevelName ? `Level up → ${input.nextLevelName}` : "Level up",
      icon: ArrowUpCircle,
      reason: "Upgrade requirements are met.",
      emphasis: "primary",
      onClick: input.onUpgrade,
      disabled: input.isUpgradeOrProvisionPending,
    });
  } else if (input.canProvision) {
    all.push({
      id: "provision",
      label: "Provision realm",
      icon: Pickaxe,
      reason: "Claim provision bonus.",
      emphasis: "primary",
      onClick: input.onProvision,
      disabled: input.isUpgradeOrProvisionPending,
    });
  }

  if (input.guardSlotsMax > 0 && input.occupiedGuardSlots === 0) {
    all.push({
      id: "garrison",
      label: "Garrison realm",
      icon: Shield,
      reason: "No defenders stationed.",
      emphasis: "primary",
      onClick: input.onOpenMilitary,
    });
  } else if (input.guardSlotsMax > 0 && input.occupiedGuardSlots < input.guardSlotsMax) {
    all.push({
      id: "garrison-partial",
      label: "Fill guard slot",
      icon: Shield,
      reason: `${input.occupiedGuardSlots}/${input.guardSlotsMax} slots occupied.`,
      emphasis: "secondary",
      onClick: input.onOpenMilitary,
    });
  }

  if (input.hasPausedProduction) {
    all.push({
      id: "resume-production",
      label: "Resume production",
      icon: Factory,
      reason: "A building is paused.",
      emphasis: "secondary",
      onClick: input.onOpenProductionModal,
    });
  } else if (input.productionTotal === 0) {
    all.push({
      id: "build-first",
      label: "Build first production",
      icon: Building2,
      reason: "No production buildings yet.",
      emphasis: "primary",
      onClick: input.onOpenConstruction,
    });
  } else if (input.productionActive < input.productionTotal) {
    all.push({
      id: "review-production",
      label: "Review production",
      icon: Factory,
      reason: `${input.productionActive}/${input.productionTotal} active.`,
      emphasis: "secondary",
      onClick: input.onOpenEconomy,
    });
  }

  if (
    input.populationCurrent !== undefined &&
    input.populationMax !== undefined &&
    input.populationMax > 0 &&
    input.populationCurrent >= input.populationMax
  ) {
    all.push({
      id: "expand-population",
      label: "Expand population",
      icon: Sparkles,
      reason: "Pop at capacity — build worker huts.",
      emphasis: "secondary",
      onClick: input.onOpenConstruction,
    });
  }

  if (all.length === 0) {
    all.push({
      id: "review",
      label: "Review economy",
      icon: Factory,
      reason: "Nothing urgent.",
      emphasis: "secondary",
      onClick: input.onOpenEconomy,
    });
  }

  const seen = new Set<string>();
  const deduped = all.filter((suggestion) => {
    if (seen.has(suggestion.id)) return false;
    seen.add(suggestion.id);
    return true;
  });

  return deduped.slice(0, MAX_SUGGESTIONS);
};
