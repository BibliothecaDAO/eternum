import {
  BattleManager,
  ContractAddress,
  getStructure,
  ID,
  ResourceManager,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { HasValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { useDojo } from "../context";

export const useResourceManager = (entityId: ID, resourceId: ResourcesIds) => {
  const dojo = useDojo();

  const resource = useEntityQuery([
    HasValue(dojo.setup.components.Resource, { entity_id: entityId, resource_type: resourceId }),
  ]);

  const resourceManager = useMemo(() => {
    return new ResourceManager(dojo.setup.components, entityId, resourceId);
  }, [entityId, resourceId, resource]);

  return resourceManager;
};

export const useIsStructureResourcesLocked = (structureEntityId: ID, currentBlockTimestamp: number) => {
  const dojo = useDojo();

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
    return battleManager.isResourcesLocked(currentBlockTimestamp!);
  }, [structure, currentBlockTimestamp]);
};
