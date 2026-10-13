import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { useTileAt } from "@/hooks/helpers/use-tile-at";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import {
  DEFAULT_COORD_ALT,
  configManager,
  getExplorerOwner,
  getArmyRelicEffects,
  getGuardsByStructure,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRowOrAbsent, useNativeRow, useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { STEALABLE_RESOURCES, type ID, type RelicEffect, type StructureType } from "@bibliothecadao/types";
import { useMemo } from "react";

import { getStructureDefenseSlotLimit, MAX_GUARD_SLOT_COUNT } from "../../utils/defense-slot-utils";
import { AttackTarget, TargetType } from "../types";

const orderResourcesByPriority = (resourceBalances: Array<{ resourceId: number; amount: number }>) => {
  return STEALABLE_RESOURCES.reduce<Array<{ resourceId: number; amount: number }>>((acc, resourceId) => {
    const resource = resourceBalances.find((item) => item.resourceId === resourceId);
    if (resource) acc.push(resource);
    return acc;
  }, []);
};

interface UseAttackTargetResult {
  attackerRelicEffects: RelicEffect[];
  targetRelicEffects: RelicEffect[];
  target: AttackTarget | null;
  targetResources: Array<{ resourceId: number; amount: number }>;
  isLoading: boolean;
}

type StructureValue = NativeRows["Structure"];

const resolveStructureGuardSlotLimit = (structure: StructureValue) => {
  const limits: number[] = [];
  const derivedLimit = getStructureDefenseSlotLimit(
    structure.base.category as StructureType | undefined,
    structure.base?.level,
  );
  if (typeof derivedLimit === "number" && Number.isFinite(derivedLimit)) {
    limits.push(derivedLimit);
  }

  const baseLimit = Number(structure.base?.troop_max_guard_count);
  if (Number.isFinite(baseLimit)) {
    limits.push(baseLimit);
  }

  if (limits.length === 0) {
    return null;
  }

  return Math.max(0, Math.min(Math.min(...limits), MAX_GUARD_SLOT_COUNT));
};

export const useAttackTargetData = (
  attackerEntityId: ID,
  targetHex: { x: number; y: number },
  targetAlt: boolean = DEFAULT_COORD_ALT,
): UseAttackTargetResult => {
  const {
    setup: { store },
  } = useGame();

  const targetTile = useTileAt(targetHex.x, targetHex.y, targetAlt);
  const guardsRevision = useNativeRevision(["ArmySlot", "Guard", "Structure"]);

  const currentDefaultTick = useCurrentDefaultTick();
  const attackerStructure = useNativeRow(
    "Structure",
    attackerEntityId !== undefined
      ? { game_id: configManager.getActiveGameId(), entity_id: attackerEntityId }
      : undefined,
  );
  const attackerExplorer = useNativeRow(
    "ExplorerTroops",
    attackerEntityId !== undefined
      ? { game_id: configManager.getActiveGameId(), explorer_id: attackerEntityId }
      : undefined,
  );
  const attackerProductionBoost = useNativeRowOrAbsent(
    "ProductionBonus",
    attackerStructure !== undefined
      ? { game_id: configManager.getActiveGameId(), entity_id: attackerEntityId }
      : undefined,
  );
  const targetEntityId = targetTile?.occupier_id;
  const targetStructure = useNativeRow(
    "Structure",
    targetEntityId !== undefined ? { game_id: configManager.getActiveGameId(), entity_id: targetEntityId } : undefined,
  );
  const targetExplorer = useNativeRow(
    "ExplorerTroops",
    targetEntityId !== undefined
      ? { game_id: configManager.getActiveGameId(), explorer_id: targetEntityId }
      : undefined,
  );
  const targetResource = useResourceManager(targetEntityId);
  const targetProductionBoost = useNativeRowOrAbsent(
    "ProductionBonus",
    targetStructure !== undefined
      ? { game_id: configManager.getActiveGameId(), entity_id: targetStructure.entity_id }
      : undefined,
  );

  const attackerRelicEffects = useMemo(() => {
    if (attackerStructure) {
      const structureRelicEffects = attackerProductionBoost
        ? getStructureRelicEffects(attackerProductionBoost, currentDefaultTick)
        : [];
      const structureArmyRelicEffects = (getGuardsByStructure(attackerStructure, store) ?? []).flatMap((guard) =>
        getStructureArmyRelicEffects(guard, currentDefaultTick),
      );

      return [...structureRelicEffects, ...structureArmyRelicEffects];
    }

    if (attackerExplorer) {
      const troops = resolveExplorerTroops(store, attackerExplorer);
      return troops ? getArmyRelicEffects(troops, currentDefaultTick) : [];
    }

    return [];
  }, [store, guardsRevision, attackerExplorer, attackerProductionBoost, attackerStructure, currentDefaultTick]);

  const target = useMemo<AttackTarget | null>(() => {
    if (!targetTile || !targetEntityId) return null;

    if (targetTile.occupier_is_structure) {
      if (!targetStructure) return null;
      const knownGuards = getGuardsByStructure(targetStructure, store);
      if (!knownGuards) return null;
      const guards = knownGuards.filter((guard) => guard.troops.count > 0n).toSorted((a, b) => a.slot - b.slot);

      return {
        info: guards.map((guard) => guard.troops),
        id: targetEntityId,
        targetType: TargetType.Structure,
        structureCategory: targetStructure.base.category,
        structureLevel: targetStructure.base.level,
        guardSlotLimit: resolveStructureGuardSlotLimit(targetStructure),
        hex: { x: targetTile.col, y: targetTile.row },
        addressOwner: targetStructure.owner,
      };
    }

    if (!targetExplorer) return null;
    const troops = resolveExplorerTroops(store, targetExplorer);
    if (!troops) return null;
    return {
      info: [troops],
      id: targetEntityId,
      targetType: TargetType.Army,
      structureCategory: null,
      hex: { x: targetTile.col, y: targetTile.row },
      addressOwner: getExplorerOwner(store, targetExplorer),
    };
  }, [store, guardsRevision, targetEntityId, targetExplorer, targetStructure, targetTile]);

  const targetRelicEffects = useMemo<RelicEffect[]>(() => {
    if (targetTile?.occupier_is_structure) {
      if (!targetStructure) return [];
      const structureRelicEffects = (getGuardsByStructure(targetStructure, store) ?? []).flatMap((guard) =>
        getStructureArmyRelicEffects(guard, currentDefaultTick),
      );
      if (!targetProductionBoost) {
        return structureRelicEffects;
      }

      return [...structureRelicEffects, ...getStructureRelicEffects(targetProductionBoost, currentDefaultTick)];
    }

    const troops = targetExplorer ? resolveExplorerTroops(store, targetExplorer) : undefined;
    return troops ? getArmyRelicEffects(troops, currentDefaultTick) : [];
  }, [
    store,
    guardsRevision,
    currentDefaultTick,
    targetExplorer,
    targetProductionBoost,
    targetStructure,
    targetTile?.occupier_is_structure,
  ]);

  const targetResources = useMemo<Array<{ resourceId: number; amount: number }>>(() => {
    if (!targetResource?.hasResources()) return [];

    if (targetTile?.occupier_is_structure) {
      return orderResourcesByPriority(targetResource.balances(currentDefaultTick) ?? []);
    }

    return orderResourcesByPriority(targetResource.balances() ?? []);
  }, [currentDefaultTick, targetResource, targetTile?.occupier_is_structure]);

  const guardsUnknown = Boolean(
    (attackerStructure && (!getGuardsByStructure(attackerStructure, store) || !attackerProductionBoost)) ||
    (targetStructure && (!getGuardsByStructure(targetStructure, store) || !targetProductionBoost)),
  );
  const isLoading =
    guardsUnknown ||
    Boolean(targetExplorer && !target) ||
    Boolean(targetEntityId && (targetTile?.occupier_is_structure ? !targetStructure : !targetExplorer));

  return {
    attackerRelicEffects,
    targetRelicEffects,
    target: guardsUnknown ? null : target,
    targetResources,
    isLoading,
  };
};
