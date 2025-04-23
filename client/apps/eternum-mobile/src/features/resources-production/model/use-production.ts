import { getBlockTimestamp } from "@/shared/hooks/use-block-timestamp";
import useStore from "@/shared/store";
import { configManager } from "@bibliothecadao/eternum";
import { getProducedResource, ResourcesIds } from "@bibliothecadao/types";
import {
  useBuildings,
  useDojo,
  usePlayerOwnedRealmsInfo,
  usePlayerOwnedVillagesInfo,
  useResourceManager,
} from "@bibliothecadao/react";
import { useCallback, useMemo } from "react";
import { LaborProductionCalldata, ResourceProductionCalldata } from "./types";

export const useProduction = () => {
  const { structureEntityId } = useStore();
  const realms = usePlayerOwnedRealmsInfo();
  const villages = usePlayerOwnedVillagesInfo();

  const realmsAndVillages = useMemo(() => {
    return [...realms, ...villages];
  }, [realms, villages]);

  const selectedRealm = useMemo(() => {
    return realmsAndVillages.find((r) => r.entityId === structureEntityId);
  }, [realmsAndVillages, structureEntityId]);

  const {
    setup: {
      components: { Resource },
      account: { account },
      systemCalls: { burn_labor_for_resource_production, burn_resource_for_resource_production },
    },
  } = useDojo();

  const buildings = useBuildings(selectedRealm?.position.x || 0, selectedRealm?.position.y || 0);
  const resourceManager = useResourceManager(structureEntityId);

  const productionBuildings = useMemo(() => {
    if (!selectedRealm) return [];
    return buildings.filter((building) => getProducedResource(building.category));
  }, [buildings, selectedRealm]);

  const producedResources = useMemo(() => {
    return Array.from(new Set(productionBuildings.map((building) => building.produced.resource)));
  }, [productionBuildings]);

  const productions = useMemo(() => {
    if (!selectedRealm) return [];
    return producedResources
      .map((resourceId) => {
        const buildingsForResource = productionBuildings.filter(
          (building) => building.produced.resource === resourceId,
        );

        const balance = resourceManager.balanceWithProduction(getBlockTimestamp().currentDefaultTick, resourceId);
        const production = resourceManager.getProduction(resourceId);

        return {
          resource: resourceId,
          balance: balance,
          production,
          buildings: buildingsForResource,
          isLabor: resourceId === ResourcesIds.Labor,
        };
      })
      .filter((production) => production !== null);
  }, [producedResources, Resource, structureEntityId, productionBuildings, resourceManager, selectedRealm]);

  const startLaborProduction = useCallback(
    async (calldata: Omit<LaborProductionCalldata, "signer">) => {
      try {
        await burn_labor_for_resource_production({
          from_entity_id: calldata.entity_id,
          production_cycles: calldata.resource_amounts,
          produced_resource_types: calldata.resource_types,
          signer: account,
        });
        return true;
      } catch (error) {
        console.error("Failed to start labor production:", error);
        return false;
      }
    },
    [burn_labor_for_resource_production, account],
  );

  const startResourceProduction = useCallback(
    async (calldata: Omit<ResourceProductionCalldata, "signer">) => {
      try {
        await burn_resource_for_resource_production({
          from_entity_id: calldata.entity_id,
          produced_resource_types: [calldata.resource_type],
          production_cycles: [calldata.amount],
          signer: account,
        });
        return true;
      } catch (error) {
        console.error("Failed to start resource production:", error);
        return false;
      }
    },
    [burn_resource_for_resource_production, account],
  );

  const pauseProduction = useCallback(async () => {
    try {
      // TODO: Implement pause functionality when available in the contract
      console.warn("Pause production not implemented yet");
      return false;
    } catch (error) {
      console.error("Failed to pause production:", error);
      return false;
    }
  }, [structureEntityId, account]);

  const resumeProduction = useCallback(async () => {
    try {
      // TODO: Implement resume functionality when available in the contract
      console.warn("Resume production not implemented yet");
      return false;
    } catch (error) {
      console.error("Failed to resume production:", error);
      return false;
    }
  }, [structureEntityId, account]);

  const destroyProduction = useCallback(async () => {
    try {
      // TODO: Implement destroy functionality when available in the contract
      console.warn("Destroy production not implemented yet");
      return false;
    } catch (error) {
      console.error("Failed to destroy production:", error);
      return false;
    }
  }, [structureEntityId, account]);

  return {
    productions,
    startLaborProduction,
    startResourceProduction,
    pauseProduction,
    resumeProduction,
    destroyProduction,
    getLaborConfig: configManager.getLaborConfig,
    selectedRealm,
  };
};
