import {
  BattleManager,
  ContractAddress,
  getStructure,
  ID,
  ResourceManager,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useMemo } from "react";
import { useDojo } from "../context";
import { useNextBlockTimestamp } from "./use-next-block-timestamp";

export const useResourceManager = (entityId: ID, resourceId: ResourcesIds) => {
  const dojo = useDojo();

  const resourceManager = useMemo(() => {
    return new ResourceManager(dojo.setup.components, entityId, resourceId);
  }, [dojo.setup, entityId, resourceId]);

  return resourceManager;
};

export const useIsStructureResourcesLocked = (structureEntityId: ID) => {
  const dojo = useDojo();
  const { nextBlockTimestamp } = useNextBlockTimestamp();

  const structure = getStructure(
    structureEntityId,
    ContractAddress(dojo.account.account.address),
    dojo.setup.components,
  );

  return useMemo(() => {
    const battleManager = new BattleManager(
      dojo.setup.components,
      dojo.network.provider,
      structure?.protector?.battle_id || 0,
    );
    return battleManager.isResourcesLocked(nextBlockTimestamp!);
  }, [structure, nextBlockTimestamp]);
};
