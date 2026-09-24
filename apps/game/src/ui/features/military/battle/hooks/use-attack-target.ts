import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import {
  DEFAULT_COORD_ALT,
  configManager,
  getExplorerOwner,
  getArmyRelicEffects,
  getGuardsByStructure,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
  StaminaManager,
  tileOptToTile,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow, useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { STEALABLE_RESOURCES, type ID, type RelicEffectWithEndTick, type StructureType } from "@bibliothecadao/types";
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
  attackerRelicEffects: RelicEffectWithEndTick[];
  targetRelicEffects: RelicEffectWithEndTick[];
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

  const targetTileOpt = useNativeRow("TileOpt", {
    game_id: configManager.getActiveGameId(),
    alt: targetAlt,
    col: targetHex.x,
    row: targetHex.y,
  });
  const guardsRevision = useNativeRevision(["Guard", "Structure"]);
  const targetTile = useMemo(() => (targetTileOpt ? tileOptToTile(targetTileOpt) : undefined), [targetTileOpt]);

  const { currentArmiesTick, currentBlockTimestamp } = useBlockTimestamp();
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
  const attackerProductionBoost = useNativeRow(
    "ProductionBonus",
    attackerEntityId !== undefined
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
  const targetResource = useResourceManager(targetEntityId ?? 0);
  const targetProductionBoost = useNativeRow(
    "ProductionBonus",
    targetEntityId !== undefined ? { game_id: configManager.getActiveGameId(), entity_id: targetEntityId } : undefined,
  );

  const attackerRelicEffects = useMemo(() => {
    if (attackerStructure) {
      const structureRelicEffects = attackerProductionBoost
        ? getStructureRelicEffects(attackerProductionBoost, currentArmiesTick)
        : [];
      const structureArmyRelicEffects = getGuardsByStructure(attackerStructure, store).flatMap((guard) =>
        getStructureArmyRelicEffects(guard, currentArmiesTick),
      );

      return [...structureRelicEffects, ...structureArmyRelicEffects];
    }

    if (attackerExplorer) {
      return getArmyRelicEffects(attackerExplorer.troops, currentArmiesTick);
    }

    return [];
  }, [store, guardsRevision, attackerExplorer, attackerProductionBoost, attackerStructure, currentArmiesTick]);

  const target = useMemo<AttackTarget | null>(() => {
    if (!targetTile || !targetEntityId) return null;

    if (targetTile.occupier_is_structure) {
      if (!targetStructure) return null;
      const guards = getGuardsByStructure(targetStructure, store)
        .filter((guard) => guard.troops.count > 0n)
        .toSorted((a, b) => a.slot - b.slot);

      return {
        info: guards.map((guard) => ({
          ...guard.troops,
          stamina: StaminaManager.getStamina(guard.troops, currentArmiesTick),
        })),
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
    return {
      info: [
        {
          ...targetExplorer.troops,
          stamina: StaminaManager.getStamina(targetExplorer.troops, currentArmiesTick),
        },
      ],
      id: targetEntityId,
      targetType: TargetType.Army,
      structureCategory: null,
      hex: { x: targetTile.col, y: targetTile.row },
      addressOwner: getExplorerOwner(store, targetExplorer),
    };
  }, [store, guardsRevision, currentArmiesTick, targetEntityId, targetExplorer, targetStructure, targetTile]);

  const targetRelicEffects = useMemo<RelicEffectWithEndTick[]>(() => {
    if (targetTile?.occupier_is_structure) {
      if (!targetStructure) return [];
      const structureRelicEffects = getGuardsByStructure(targetStructure, store).flatMap((guard) =>
        getStructureArmyRelicEffects(guard, currentArmiesTick),
      );
      if (!targetProductionBoost) {
        return structureRelicEffects;
      }

      return [...structureRelicEffects, ...getStructureRelicEffects(targetProductionBoost, currentArmiesTick)];
    }

    return targetExplorer ? getArmyRelicEffects(targetExplorer.troops, currentArmiesTick) : [];
  }, [
    store,
    guardsRevision,
    currentArmiesTick,
    targetExplorer,
    targetProductionBoost,
    targetStructure,
    targetTile?.occupier_is_structure,
  ]);

  const targetResources = useMemo<Array<{ resourceId: number; amount: number }>>(() => {
    if (!targetResource.hasResources()) return [];

    if (targetTile?.occupier_is_structure) {
      const oneMinuteAgo = currentBlockTimestamp - 60;
      return orderResourcesByPriority(targetResource.balances(oneMinuteAgo) ?? []);
    }

    return orderResourcesByPriority(targetResource.balances() ?? []);
  }, [currentBlockTimestamp, targetResource, targetTile?.occupier_is_structure]);

  const isLoading = Boolean(targetEntityId && (targetTile?.occupier_is_structure ? !targetStructure : !targetExplorer));

  return {
    attackerRelicEffects,
    targetRelicEffects,
    target,
    targetResources,
    isLoading,
  };
};
