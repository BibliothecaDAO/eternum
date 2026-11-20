import { GUARD_MODELS } from "@bibliothecadao/eternum/game-client";
import { resolveExplorerCombatTroops } from "@bibliothecadao/eternum/troop-stamina";
import { useTileAt } from "@/hooks/helpers/use-tile-at";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import {
  DEFAULT_COORD_ALT,
  configManager,
  getExplorerOwner,
  getDefendingGuards,
  getGuardsByStructure,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow, useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { STEALABLE_RESOURCES, type ID } from "@bibliothecadao/types";
import { useMemo } from "react";

import { structureGuardSlots } from "../../utils/defense-slot-utils";
import { AttackTarget, TargetType } from "../types";

const orderResourcesByPriority = (resourceBalances: Array<{ resourceId: number; amount: number }>) => {
  return STEALABLE_RESOURCES.reduce<Array<{ resourceId: number; amount: number }>>((acc, resourceId) => {
    const resource = resourceBalances.find((item) => item.resourceId === resourceId);
    if (resource) acc.push(resource);
    return acc;
  }, []);
};

interface UseAttackTargetResult {
  target: AttackTarget | null;
  targetResources: Array<{ resourceId: number; amount: number }>;
  isLoading: boolean;
}

export const useAttackTargetData = (
  attackerEntityId: ID,
  targetHex: { x: number; y: number },
  targetAlt: boolean = DEFAULT_COORD_ALT,
): UseAttackTargetResult => {
  const {
    setup: { store },
  } = useGame();

  const targetTile = useTileAt(targetHex.x, targetHex.y, targetAlt);
  const guardsFacts = useNativeFacts(["ArmySlot", "ArmyRelicEffect", "ArmyProgress", ...GUARD_MODELS, "Structure"]);

  const currentDefaultTick = useCurrentDefaultTick();
  const attackerStructure = useNativeRow(
    "Structure",
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
  const targetResource = useResourceManager(targetEntityId);

  const target = useMemo<AttackTarget | null>(() => {
    if (!targetTile || !targetEntityId) return null;

    if (targetTile.occupier_is_structure) {
      if (!targetStructure) return null;
      const guards = getDefendingGuards(targetStructure, guardsFacts.store);
      if (!guards) return null;

      return {
        info: guards.map((guard) => guard.troops),
        id: targetEntityId,
        targetType: TargetType.Structure,
        structureCategory: targetStructure.base.category,
        structureLevel: targetStructure.base.level,
        guardSlots: structureGuardSlots(targetStructure),
        hex: { x: targetTile.col, y: targetTile.row },
        addressOwner: targetStructure.owner,
      };
    }

    if (!targetExplorer) return null;
    const troops = resolveExplorerCombatTroops(guardsFacts.store, targetExplorer, currentDefaultTick);
    if (!troops) return null;
    return {
      info: [troops],
      id: targetEntityId,
      targetType: TargetType.Army,
      structureCategory: null,
      hex: { x: targetTile.col, y: targetTile.row },
      addressOwner: getExplorerOwner(guardsFacts.store, targetExplorer),
    };
  }, [guardsFacts, targetEntityId, targetExplorer, targetStructure, targetTile, currentDefaultTick]);

  const targetResources = useMemo<Array<{ resourceId: number; amount: number }>>(() => {
    if (!targetResource?.hasResources()) return [];

    if (targetTile?.occupier_is_structure) {
      return orderResourcesByPriority(targetResource.balances(currentDefaultTick) ?? []);
    }

    return orderResourcesByPriority(targetResource.balances() ?? []);
  }, [currentDefaultTick, targetResource, targetTile?.occupier_is_structure]);

  const guardsUnknown = Boolean(
    (attackerStructure && !getGuardsByStructure(attackerStructure, store)) ||
    (targetStructure && !getGuardsByStructure(targetStructure, store)),
  );
  const isLoading =
    guardsUnknown ||
    Boolean(targetExplorer && !target) ||
    Boolean(targetEntityId && (targetTile?.occupier_is_structure ? !targetStructure : !targetExplorer));

  return {
    target: guardsUnknown ? null : target,
    targetResources,
    isLoading,
  };
};
