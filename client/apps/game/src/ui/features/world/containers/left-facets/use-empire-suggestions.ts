import type { LucideIcon } from "lucide-react";
import ArrowUpCircle from "lucide-react/dist/esm/icons/arrow-up-circle";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import ChevronsUp from "lucide-react/dist/esm/icons/chevrons-up";
import Pickaxe from "lucide-react/dist/esm/icons/pickaxe";
import Shield from "lucide-react/dist/esm/icons/shield";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { useMemo } from "react";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { useStructuresWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata";
import { useDojo } from "@bibliothecadao/react";
import { type ID, StructureType } from "@bibliothecadao/types";

/**
 * Empire-wide action descriptors. Each one is tied to a specific realm so the
 * panel can render "ta Tin · Garrison realm" chips with one-click navigation +
 * action.
 *
 * The `action` field is a coarse instruction the panel uses to dispatch the
 * right behavior (open modal, fire tx, etc.). We intentionally don't store
 * raw callbacks because the hook list can change across renders and would
 * trip up downstream memoization.
 */
export type EmpireSuggestionAction =
  | "upgrade-and-provision"
  | "upgrade"
  | "provision"
  | "garrison"
  | "build-first"
  | "expand-population";

export interface EmpireSuggestion {
  id: string;
  realmId: ID;
  realmName: string;
  action: EmpireSuggestionAction;
  /** "Garrison realm", "Upgrade to Hamlet", ... — no realm prefix here. */
  label: string;
  icon: LucideIcon;
  reason?: string;
  emphasis: "primary" | "secondary";
}

const ACTION_PRIORITY: Record<EmpireSuggestionAction, number> = {
  "upgrade-and-provision": 0,
  upgrade: 1,
  provision: 2,
  garrison: 3,
  "build-first": 4,
  "expand-population": 5,
};

const ACTION_EMPHASIS: Record<EmpireSuggestionAction, "primary" | "secondary"> = {
  "upgrade-and-provision": "primary",
  upgrade: "primary",
  provision: "primary",
  garrison: "primary",
  "build-first": "primary",
  "expand-population": "secondary",
};

/**
 * Aggregates per-realm suggestions across the entire empire. Reads only cheap
 * RECS-backed metadata (already memoized in `useStructuresWithMetadata`) so
 * the cost is O(N owned structures), no per-structure torii calls.
 */
export const useEmpireSuggestions = (): EmpireSuggestion[] => {
  const {
    setup: { components },
  } = useDojo();
  const playerStructures = useUIStore((state) => state.playerStructures);
  const structureNameVersion = useUIStore((state) => state.structureNameVersion);
  const metadata = useStructuresWithMetadata({
    structures: playerStructures,
    components,
    nameUpdateVersion: structureNameVersion,
  });

  return useMemo(() => {
    const out: EmpireSuggestion[] = [];

    for (const structure of metadata) {
      if (structure.category !== StructureType.Realm) continue;

      const realmId = structure.entityId;
      const realmName = structure.displayName;
      const base = structure.structure?.base;
      const occupiedGuards = Number(base?.troop_guard_count ?? 0);
      const maxGuards = Number(base?.troop_max_guard_count ?? 0);

      // Highest-value action: both upgrade AND provision available in one tx.
      if (structure.canUpgrade && structure.canProvision) {
        out.push({
          id: `${realmId}-upgrade-and-provision`,
          realmId,
          realmName,
          action: "upgrade-and-provision",
          label: structure.realmLevelLabel
            ? `Upgrade ${structure.realmLevelLabel} + provision`
            : "Upgrade & provision",
          icon: ChevronsUp,
          reason: "Meets both upgrade cost and provision conditions.",
          emphasis: "primary",
        });
        continue;
      }

      if (structure.canUpgrade) {
        out.push({
          id: `${realmId}-upgrade`,
          realmId,
          realmName,
          action: "upgrade",
          label: "Level up realm",
          icon: ArrowUpCircle,
          reason: "Upgrade requirements are met.",
          emphasis: "primary",
        });
      }

      if (structure.canProvision) {
        out.push({
          id: `${realmId}-provision`,
          realmId,
          realmName,
          action: "provision",
          label: "Provision realm",
          icon: Pickaxe,
          reason: "Claim provision bonus.",
          emphasis: "primary",
        });
      }

      if (maxGuards > 0 && occupiedGuards === 0) {
        out.push({
          id: `${realmId}-garrison`,
          realmId,
          realmName,
          action: "garrison",
          label: "Garrison realm",
          icon: Shield,
          reason: "No defenders stationed.",
          emphasis: "primary",
        });
      }

      // Cheap empire-wide population signal — at capacity means worker huts
      // are the obvious next move.
      if (
        structure.populationCapacity > 0 &&
        structure.population >= structure.populationCapacity
      ) {
        out.push({
          id: `${realmId}-expand-population`,
          realmId,
          realmName,
          action: "expand-population",
          label: "Expand population",
          icon: Sparkles,
          reason: "Population at capacity.",
          emphasis: "secondary",
        });
      }

      // Empty build canvas: tile occupancy is zero (only the keep counts).
      if (structure.buildingTilesOccupied === 0) {
        out.push({
          id: `${realmId}-build-first`,
          realmId,
          realmName,
          action: "build-first",
          label: "Build first production",
          icon: Building2,
          reason: "No buildings constructed yet.",
          emphasis: "primary",
        });
      }
    }

    // Sort: primary first (by action priority), secondary after — within each
    // tier preserve realm insertion order so the same realm's suggestions
    // stay clustered.
    return out.toSorted((a, b) => {
      const aEmphasis = ACTION_EMPHASIS[a.action];
      const bEmphasis = ACTION_EMPHASIS[b.action];
      if (aEmphasis !== bEmphasis) return aEmphasis === "primary" ? -1 : 1;
      return ACTION_PRIORITY[a.action] - ACTION_PRIORITY[b.action];
    });
  }, [metadata]);
};
