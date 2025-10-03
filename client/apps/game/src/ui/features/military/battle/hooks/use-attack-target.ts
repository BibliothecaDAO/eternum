import { sqlApi } from "@/services/api";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import {
  getArmyRelicEffects,
  getGuardsByStructure,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
  getBlockTimestamp,
  ResourceManager,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getExplorerFromToriiClient, getStructureFromToriiClient } from "@bibliothecadao/torii";
import { useComponentValue } from "@dojoengine/react";
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

export const useAttackTargetData = (attackerEntityId: ID, targetHex: { x: number; y: number }): UseAttackTargetResult => {
  const {
    network: { toriiClient },
    setup: {
      components: { Tile, Structure, ExplorerTroops, ProductionBoostBonus },
    },
  } = useDojo();

  const targetTileEntityId = useMemo(
    () => getEntityIdFromKeys([BigInt(targetHex.x), BigInt(targetHex.y)]),
    [targetHex.x, targetHex.y],
  );
  const targetTile = useComponentValue(Tile, targetTileEntityId);

  const [target, setTarget] = useState<AttackTarget | null>(null);
  const [targetResources, setTargetResources] = useState<Array<{ resourceId: number; amount: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [attackerRelicEffects, setAttackerRelicEffects] = useState<RelicEffectWithEndTick[]>([]);
  const [targetRelicEffects, setTargetRelicEffects] = useState<RelicEffectWithEndTick[]>([]);

  useEffect(() => {
    const { currentArmiesTick } = getBlockTimestamp();
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

      setAttackerRelicEffects([...structureRelicEffects, ...structureArmyRelicEffects]);
      return;
    }

    const explorer = getComponentValue(ExplorerTroops, getEntityIdFromKeys([BigInt(attackerEntityId)]));
    if (explorer) {
      setAttackerRelicEffects(getArmyRelicEffects(explorer.troops, currentArmiesTick));
    } else {
      setAttackerRelicEffects([]);
    }
  }, [attackerEntityId, Structure, ExplorerTroops, ProductionBoostBonus]);

  useEffect(() => {
    let isActive = true;

    const loadTarget = async () => {
      if (!targetTile?.occupier_id) {
        if (isActive) {
          setTarget(null);
          setTargetResources([]);
          setTargetRelicEffects([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      try {
        const isStructure = targetTile.occupier_is_structure;
        const { currentArmiesTick, currentBlockTimestamp } = getBlockTimestamp();

        if (isStructure) {
          const { structure, resources, productionBoostBonus } = await getStructureFromToriiClient(
            toriiClient,
            targetTile.occupier_id,
          );

          if (!isActive) return;

          if (structure) {
            const relicEffects = getStructureArmyRelicEffects(structure, currentArmiesTick);
            const guards = getGuardsByStructure(structure).filter((guard) => guard.troops.count > 0n);

            setTarget({
              info: guards.map((guard) => ({
                ...guard.troops,
                stamina: StaminaManager.getStamina(guard.troops, currentArmiesTick),
              })),
              id: targetTile.occupier_id,
              targetType: TargetType.Structure,
              structureCategory: structure.category,
              hex: { x: targetTile.col, y: targetTile.row },
              addressOwner: structure.owner,
            });

            if (productionBoostBonus) {
              setTargetRelicEffects([
                ...relicEffects,
                ...getStructureRelicEffects(productionBoostBonus, currentArmiesTick),
              ]);
            } else {
              setTargetRelicEffects(relicEffects);
            }
          } else {
            setTarget(null);
          }

          if (resources) {
            const oneMinuteAgo = currentBlockTimestamp - 60;
            setTargetResources(
              orderResourcesByPriority(ResourceManager.getResourceBalancesWithProduction(resources, oneMinuteAgo)),
            );
          } else {
            setTargetResources([]);
          }
        } else {
          const { explorer, resources } = await getExplorerFromToriiClient(toriiClient, targetTile.occupier_id);

          if (!isActive) return;

          if (resources) {
            setTargetResources(orderResourcesByPriority(ResourceManager.getResourceBalances(resources)));
          } else {
            setTargetResources([]);
          }

          if (explorer) {
            const relicEffects = getArmyRelicEffects(explorer.troops, currentArmiesTick);
            setTargetRelicEffects(relicEffects);

            const addressOwner = await sqlApi.fetchExplorerAddressOwner(targetTile.occupier_id);
            if (!isActive) return;

            setTarget({
              info: [
                {
                  ...explorer.troops,
                  stamina: StaminaManager.getStamina(explorer.troops, currentArmiesTick),
                },
              ],
              id: targetTile.occupier_id,
              targetType: TargetType.Army,
              structureCategory: null,
              hex: { x: targetTile.col, y: targetTile.row },
              addressOwner,
            });
          } else {
            setTarget(null);
            setTargetRelicEffects([]);
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

  return {
    attackerRelicEffects,
    targetRelicEffects,
    target,
    targetResources,
    isLoading,
  };
};
