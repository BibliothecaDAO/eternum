import { gameEntityKey } from "@/dojo/game-scope";
import { useGameEntityComponentValue } from "@/hooks/helpers/use-game-entity-component-value";
import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import {
  DEFAULT_COORD_ALT,
  getArmyRelicEffects,
  getGuardsByStructure,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
  ResourceManager,
  StaminaManager,
  tileOptToTile,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import {
  ContractAddress,
  STEALABLE_RESOURCES,
  type ClientComponents,
  type ID,
  type RelicEffectWithEndTick,
  type StructureType,
  type TileOpt,
} from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import type { ComponentValue } from "@dojoengine/recs";
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

type StructureValue = ComponentValue<ClientComponents["Structure"]["schema"]>;

const resolveStructureGuardSlotLimit = (structure: StructureValue) => {
  const limits: number[] = [];
  const derivedLimit = getStructureDefenseSlotLimit(
    structure.category as StructureType | undefined,
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
    setup: { components },
  } = useDojo();

  const targetTileEntity = useMemo(
    () => gameEntityKey([BigInt(targetAlt ? 1 : 0), BigInt(targetHex.x), BigInt(targetHex.y)]),
    [targetAlt, targetHex.x, targetHex.y],
  );
  const targetTileOpt = useComponentValue(components.TileOpt, targetTileEntity);
  const targetTile = useMemo(
    () => (targetTileOpt ? tileOptToTile(targetTileOpt as unknown as TileOpt) : undefined),
    [targetTileOpt],
  );

  const { currentArmiesTick, currentBlockTimestamp } = useBlockTimestamp();
  const attackerStructure = useGameEntityComponentValue(components.Structure, attackerEntityId);
  const attackerExplorer = useGameEntityComponentValue(components.ExplorerTroops, attackerEntityId);
  const attackerProductionBoost = useGameEntityComponentValue(components.ProductionBoostBonus, attackerEntityId);
  const targetEntityId = targetTile?.occupier_id;
  const targetStructure = useGameEntityComponentValue(components.Structure, targetEntityId);
  const targetExplorer = useGameEntityComponentValue(components.ExplorerTroops, targetEntityId);
  const targetResource = useGameEntityComponentValue(components.Resource, targetEntityId);
  const targetProductionBoost = useGameEntityComponentValue(components.ProductionBoostBonus, targetEntityId);
  const targetOwnerStructure = useGameEntityComponentValue(components.Structure, targetExplorer?.owner);

  const attackerRelicEffects = useMemo(() => {
    if (attackerStructure) {
      const structureRelicEffects = attackerProductionBoost
        ? getStructureRelicEffects(attackerProductionBoost, currentArmiesTick)
        : [];
      const structureArmyRelicEffects = getStructureArmyRelicEffects(attackerStructure, currentArmiesTick);

      return [...structureRelicEffects, ...structureArmyRelicEffects];
    }

    if (attackerExplorer) {
      return getArmyRelicEffects(attackerExplorer.troops, currentArmiesTick);
    }

    return [];
  }, [attackerExplorer, attackerProductionBoost, attackerStructure, currentArmiesTick]);

  const target = useMemo<AttackTarget | null>(() => {
    if (!targetTile || !targetEntityId) return null;

    if (targetTile.occupier_is_structure) {
      if (!targetStructure) return null;
      const guards = getGuardsByStructure(targetStructure)
        .filter((guard) => guard.troops.count > 0n)
        .toSorted((a, b) => a.slot - b.slot);

      return {
        info: guards.map((guard) => ({
          ...guard.troops,
          stamina: StaminaManager.getStamina(guard.troops, currentArmiesTick),
        })),
        id: targetEntityId,
        targetType: TargetType.Structure,
        structureCategory: targetStructure.category,
        structureLevel: Number(targetStructure.base?.level ?? 0),
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
      addressOwner: targetOwnerStructure ? ContractAddress(targetOwnerStructure.owner) : null,
    };
  }, [currentArmiesTick, targetEntityId, targetExplorer, targetOwnerStructure, targetStructure, targetTile]);

  const targetRelicEffects = useMemo<RelicEffectWithEndTick[]>(() => {
    if (targetTile?.occupier_is_structure) {
      if (!targetStructure) return [];
      const structureRelicEffects = getStructureArmyRelicEffects(targetStructure, currentArmiesTick);
      if (!targetProductionBoost) {
        return structureRelicEffects;
      }

      return [...structureRelicEffects, ...getStructureRelicEffects(targetProductionBoost, currentArmiesTick)];
    }

    return targetExplorer ? getArmyRelicEffects(targetExplorer.troops, currentArmiesTick) : [];
  }, [currentArmiesTick, targetExplorer, targetProductionBoost, targetStructure, targetTile?.occupier_is_structure]);

  const targetResources = useMemo<Array<{ resourceId: number; amount: number }>>(() => {
    if (!targetResource) return [];

    if (targetTile?.occupier_is_structure) {
      const oneMinuteAgo = currentBlockTimestamp - 60;
      return orderResourcesByPriority(ResourceManager.getResourceBalancesWithProduction(targetResource, oneMinuteAgo));
    }

    return orderResourcesByPriority(ResourceManager.getResourceBalances(targetResource));
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
