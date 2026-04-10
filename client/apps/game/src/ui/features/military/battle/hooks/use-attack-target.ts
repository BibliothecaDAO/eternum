import { sqlApi } from "@/services/api";
import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import {
  DEFAULT_COORD_ALT,
  getArmyRelicEffects,
  getGuardsByStructure,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
  getTileAt,
  ResourceManager,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getExplorerFromToriiClient, getStructureFromToriiClient } from "@bibliothecadao/torii";
import { getComponentValue } from "@dojoengine/recs";
import { useEffect, useMemo, useState } from "react";

import { AttackTarget, TargetType } from "../types";

import type { ID, RelicEffectWithEndTick } from "@bibliothecadao/types";
import { STEALABLE_RESOURCES } from "@bibliothecadao/types";

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

type StructureTargetFetchResult = Awaited<ReturnType<typeof getStructureFromToriiClient>>;
type ExplorerTargetFetchResult = Awaited<ReturnType<typeof getExplorerFromToriiClient>>;

type FetchedAttackTarget =
  | {
      targetType: TargetType.Structure;
      id: ID;
      hex: { x: number; y: number };
      structure: NonNullable<StructureTargetFetchResult["structure"]>;
      resources: StructureTargetFetchResult["resources"];
      productionBoostBonus: StructureTargetFetchResult["productionBoostBonus"];
    }
  | {
      targetType: TargetType.Army;
      id: ID;
      hex: { x: number; y: number };
      explorer: NonNullable<ExplorerTargetFetchResult["explorer"]>;
      resources: ExplorerTargetFetchResult["resources"];
      addressOwner: Awaited<ReturnType<typeof sqlApi.fetchExplorerAddressOwner>>;
    };

export const useAttackTargetData = (
  attackerEntityId: ID,
  targetHex: { x: number; y: number },
  targetAlt: boolean = DEFAULT_COORD_ALT,
): UseAttackTargetResult => {
  const {
    network: { toriiClient },
    setup: {
      components,
      components: { Structure, ExplorerTroops, ProductionBoostBonus },
    },
  } = useDojo();

  const targetTile = useMemo(
    () => getTileAt(components, targetAlt, targetHex.x, targetHex.y),
    [components, targetAlt, targetHex.x, targetHex.y],
  );

  const [fetchedTarget, setFetchedTarget] = useState<FetchedAttackTarget | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { currentArmiesTick, currentBlockTimestamp } = useBlockTimestamp();

  const attackerRelicEffects = useMemo(() => {
    const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(attackerEntityId)]));

    if (structure) {
      const productionBoostBonus = getComponentValue(
        ProductionBoostBonus,
        getEntityIdFromKeys([BigInt(structure.entity_id)]),
      );

      const structureRelicEffects = productionBoostBonus
        ? getStructureRelicEffects(productionBoostBonus, currentArmiesTick)
        : [];
      const structureArmyRelicEffects = getStructureArmyRelicEffects(structure, currentArmiesTick);

      return [...structureRelicEffects, ...structureArmyRelicEffects];
    }

    const explorer = getComponentValue(ExplorerTroops, getEntityIdFromKeys([BigInt(attackerEntityId)]));
    if (explorer) {
      return getArmyRelicEffects(explorer.troops, currentArmiesTick);
    }

    return [];
  }, [attackerEntityId, Structure, ExplorerTroops, ProductionBoostBonus, currentArmiesTick]);

  useEffect(() => {
    let isActive = true;

    const loadTarget = async () => {
      if (!targetTile?.occupier_id) {
        if (isActive) {
          setFetchedTarget(null);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      try {
        const isStructure = targetTile.occupier_is_structure;

        if (isStructure) {
          const { structure, resources, productionBoostBonus } = await getStructureFromToriiClient(
            toriiClient,
            targetTile.occupier_id,
          );

          if (!isActive) return;

          if (structure) {
            setFetchedTarget({
              targetType: TargetType.Structure,
              id: targetTile.occupier_id,
              hex: { x: targetTile.col, y: targetTile.row },
              structure,
              resources,
              productionBoostBonus,
            });
          } else {
            setFetchedTarget(null);
          }
        } else {
          const { explorer, resources } = await getExplorerFromToriiClient(toriiClient, targetTile.occupier_id);

          if (!isActive) return;

          if (explorer) {
            const addressOwner = await sqlApi.fetchExplorerAddressOwner(targetTile.occupier_id);
            if (!isActive) return;

            setFetchedTarget({
              targetType: TargetType.Army,
              id: targetTile.occupier_id,
              hex: { x: targetTile.col, y: targetTile.row },
              addressOwner,
              explorer,
              resources,
            });
          } else {
            setFetchedTarget(null);
          }
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadTarget();

    return () => {
      isActive = false;
    };
  }, [targetTile, toriiClient]);

  const target = useMemo<AttackTarget | null>(() => {
    if (!fetchedTarget) return null;

    if (fetchedTarget.targetType === TargetType.Structure) {
      const guards = getGuardsByStructure(fetchedTarget.structure)
        .filter((guard) => guard.troops.count > 0n)
        .toSorted((a, b) => a.slot - b.slot);

      return {
        info: guards.map((guard) => ({
          ...guard.troops,
          stamina: StaminaManager.getStamina(guard.troops, currentArmiesTick),
        })),
        id: fetchedTarget.id,
        targetType: TargetType.Structure,
        structureCategory: fetchedTarget.structure.category,
        hex: fetchedTarget.hex,
        addressOwner: fetchedTarget.structure.owner,
      };
    }

    return {
      info: [
        {
          ...fetchedTarget.explorer.troops,
          stamina: StaminaManager.getStamina(fetchedTarget.explorer.troops, currentArmiesTick),
        },
      ],
      id: fetchedTarget.id,
      targetType: TargetType.Army,
      structureCategory: null,
      hex: fetchedTarget.hex,
      addressOwner: fetchedTarget.addressOwner,
    };
  }, [currentArmiesTick, fetchedTarget]);

  const targetRelicEffects = useMemo<RelicEffectWithEndTick[]>(() => {
    if (!fetchedTarget) return [];

    if (fetchedTarget.targetType === TargetType.Structure) {
      const structureRelicEffects = getStructureArmyRelicEffects(fetchedTarget.structure, currentArmiesTick);
      if (!fetchedTarget.productionBoostBonus) {
        return structureRelicEffects;
      }

      return [
        ...structureRelicEffects,
        ...getStructureRelicEffects(fetchedTarget.productionBoostBonus, currentArmiesTick),
      ];
    }

    return getArmyRelicEffects(fetchedTarget.explorer.troops, currentArmiesTick);
  }, [currentArmiesTick, fetchedTarget]);

  const targetResources = useMemo<Array<{ resourceId: number; amount: number }>>(() => {
    if (!fetchedTarget?.resources) return [];

    if (fetchedTarget.targetType === TargetType.Structure) {
      const oneMinuteAgo = currentBlockTimestamp - 60;
      return orderResourcesByPriority(
        ResourceManager.getResourceBalancesWithProduction(fetchedTarget.resources, oneMinuteAgo),
      );
    }

    return orderResourcesByPriority(ResourceManager.getResourceBalances(fetchedTarget.resources));
  }, [currentBlockTimestamp, fetchedTarget]);

  return {
    attackerRelicEffects,
    targetRelicEffects,
    target,
    targetResources,
    isLoading,
  };
};
