import type { LucideIcon } from "lucide-react";
import ArrowUpCircle from "lucide-react/dist/esm/icons/arrow-up-circle";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import HomeIcon from "lucide-react/dist/esm/icons/home";
import Pickaxe from "lucide-react/dist/esm/icons/pickaxe";
import Shield from "lucide-react/dist/esm/icons/shield";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Wheat from "lucide-react/dist/esm/icons/wheat";
import { useMemo } from "react";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { useStructuresWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata";
import { useDojo } from "@bibliothecadao/react";
import { BuildingType, type ID, StructureType } from "@bibliothecadao/types";

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
  | "build-wheat"
  | "build-wood"
  | "build-coal"
  | "build-copper"
  | "build-worker-hut"
  | "garrison"
  | "upgrade"
  | "provision"
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
  /** Optional building hint so the construction view can preselect it. */
  buildingTypeHint?: BuildingType;
  reason?: string;
  emphasis: "primary" | "secondary";
}

const ACTION_PRIORITY: Record<EmpireSuggestionAction, number> = {
  "upgrade-and-provision": 0,
  "build-wheat": 1,
  "build-wood": 2,
  "build-coal": 3,
  "build-copper": 4,
  "build-worker-hut": 5,
  garrison: 6,
  upgrade: 7,
  provision: 8,
  "build-first": 9,
  "expand-population": 10,
};

const ACTION_EMPHASIS: Record<EmpireSuggestionAction, "primary" | "secondary"> = {
  "upgrade-and-provision": "primary",
  "build-wheat": "primary",
  "build-wood": "primary",
  "build-coal": "primary",
  "build-copper": "primary",
  "build-worker-hut": "primary",
  garrison: "primary",
  upgrade: "primary",
  provision: "primary",
  "build-first": "primary",
  "expand-population": "secondary",
};

const WHEAT_FARMS_PER_LEVEL = 4;
/** Trigger worker-hut suggestion proactively at >=70% pop usage, not just at the cap. */
const POPULATION_PRESSURE_RATIO = 0.7;

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

      // Highest-value action: first-ever upgrade also provisions the realm in one tx.
      if (structure.canUpgrade && structure.canProvision) {
        out.push({
          id: `${realmId}-upgrade-and-provision`,
          realmId,
          realmName,
          action: "upgrade-and-provision",
          label: "Bootstrap realm",
          icon: Pickaxe,
          reason: "Level up + provision.",
          emphasis: "primary",
        });
        continue;
      }

      // Post-bootstrap construction progression: only suggest building when the
      // realm has actually been bootstrapped (level >= Hamlet) and is past the
      // provision step. Targets scale with realm level — bigger realms need
      // more production to sustain their bigger build canvas.
      const isBootstrapped = !structure.canProvision && structure.realmLevel >= 1;
      const counts = structure.buildingCounts;
      const wheatTarget = WHEAT_FARMS_PER_LEVEL * structure.realmLevel;
      const isPopulationPressured =
        structure.populationCapacity > 0 &&
        structure.population / structure.populationCapacity >= POPULATION_PRESSURE_RATIO &&
        structure.population < structure.populationCapacity;

      if (isBootstrapped) {
        if (counts.wheat < wheatTarget) {
          out.push({
            id: `${realmId}-build-wheat`,
            realmId,
            realmName,
            action: "build-wheat",
            label: "Build wheat farm",
            icon: Wheat,
            buildingTypeHint: BuildingType.ResourceWheat,
            reason: `${counts.wheat}/${wheatTarget} farms.`,
            emphasis: "primary",
          });
        }
        if (counts.wood < 1) {
          out.push({
            id: `${realmId}-build-wood`,
            realmId,
            realmName,
            action: "build-wood",
            label: "Build wood camp",
            icon: Building2,
            buildingTypeHint: BuildingType.ResourceWood,
            reason: "No wood production.",
            emphasis: "primary",
          });
        }
        if (counts.coal < 1) {
          out.push({
            id: `${realmId}-build-coal`,
            realmId,
            realmName,
            action: "build-coal",
            label: "Build coal mine",
            icon: Building2,
            buildingTypeHint: BuildingType.ResourceCoal,
            reason: "No coal production.",
            emphasis: "primary",
          });
        }
        if (counts.copper < 1) {
          out.push({
            id: `${realmId}-build-copper`,
            realmId,
            realmName,
            action: "build-copper",
            label: "Build copper mine",
            icon: Building2,
            buildingTypeHint: BuildingType.ResourceCopper,
            reason: "No copper production.",
            emphasis: "primary",
          });
        }
        if (isPopulationPressured) {
          out.push({
            id: `${realmId}-build-worker-hut`,
            realmId,
            realmName,
            action: "build-worker-hut",
            label: "Build worker hut",
            icon: HomeIcon,
            buildingTypeHint: BuildingType.WorkersHut,
            reason: `${structure.population}/${structure.populationCapacity} pop.`,
            emphasis: "primary",
          });
        }
      }

      if (structure.canUpgrade) {
        out.push({
          id: `${realmId}-upgrade`,
          realmId,
          realmName,
          action: "upgrade",
          label: "Level up realm",
          icon: ArrowUpCircle,
          reason: "Requirements met.",
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

      // Hard-cap fallback: keep the secondary nudge for when the player has
      // already ignored the worker-hut suggestion and hit the wall.
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
          reason: "No buildings yet.",
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
