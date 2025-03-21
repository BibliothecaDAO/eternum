import { getBlockTimestamp } from "@/shared/lib/hooks/use-block-timestamp";
import useStore from "@/shared/store";
import { getProducedResource, ResourcesIds } from "@bibliothecadao/eternum";
import { useBuildings, useDojo, usePlayerOwnedRealmsAndVillagesInfo, useResourceManager } from "@bibliothecadao/react";
import { useCallback, useMemo } from "react";
import { getLaborConfig } from "../lib/labor";
import { LaborProductionCalldata, ResourceProductionCalldata } from "./types";

export const useProduction = () => {
  const { structureEntityId } = useStore();
  const realmsAndVillages = usePlayerOwnedRealmsAndVillagesInfo();

  const selectedRealm = useMemo(() => {
    return realmsAndVillages.find((r) => r.entityId === structureEntityId);
  }, [realmsAndVillages, structureEntityId]);

  const {
    setup: {
      components: { Resource },
      account: { account },
      systemCalls: { burn_labor_resources_for_other_production, burn_other_predefined_resources_for_resources },
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
        await burn_labor_resources_for_other_production({
          from_entity_id: calldata.entity_id,
          labor_amounts: calldata.resource_amounts,
          produced_resource_types: calldata.resource_types,
          signer: account,
        });
        return true;
      } catch (error) {
        console.error("Failed to start labor production:", error);
        return false;
      }
    },
    [burn_labor_resources_for_other_production, account],
  );

  const startResourceProduction = useCallback(
    async (calldata: Omit<ResourceProductionCalldata, "signer">) => {
      try {
        await burn_other_predefined_resources_for_resources({
          from_entity_id: calldata.entity_id,
          produced_resource_types: [calldata.resource_type],
          production_tick_counts: [calldata.amount],
          signer: account,
        });
        return true;
      } catch (error) {
        console.error("Failed to start resource production:", error);
        return false;
      }
    },
    [burn_other_predefined_resources_for_resources, account],
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
    getLaborConfig,
    selectedRealm,
  };
};
