import { useCallback } from "react";
import type { ChainType } from "../utils/manifest-loader";
import { checkIndexerExists as checkIndexerExistsService, getWorldDeployedAddress as getWorldDeployedAddressService } from "../services/factory-indexer";
import { cacheDeployedAddress, getDeployedAddressMap } from "../utils/storage";

export const useFactoryAdmin = (chain: ChainType) => {
  const getWorldDeployedAddressLocal = useCallback(
    async (worldName: string): Promise<string | null> => {
      const cached = getDeployedAddressMap()[worldName];
      if (cached) return cached;
      const addr = await getWorldDeployedAddressService(chain as any, worldName);
      if (addr) cacheDeployedAddress(worldName, addr);
      return addr;
    },
    [chain],
  );

  const checkIndexerExists = useCallback(async (worldName: string) => {
    return checkIndexerExistsService(worldName);
  }, []);

  const refreshStatuses = useCallback(async (worldNames: string[]) => {
    const statusPromises = worldNames.map(async (worldName) => {
      const [indexerExists, deployedAddress] = await Promise.all([
        checkIndexerExists(worldName),
        getWorldDeployedAddressLocal(worldName),
      ]);
      return { worldName, indexerExists, isDeployed: !!deployedAddress, deployedAddress };
    });

    const results = await Promise.all(statusPromises);
    const indexerStatusMap: Record<string, boolean> = {};
    const deployedStatusMap: Record<string, boolean> = {};
    results.forEach(({ worldName, indexerExists, isDeployed, deployedAddress }) => {
      indexerStatusMap[worldName] = indexerExists;
      deployedStatusMap[worldName] = isDeployed;
      if (deployedAddress) cacheDeployedAddress(worldName, deployedAddress);
    });
    return { indexerStatusMap, deployedStatusMap };
  }, [getWorldDeployedAddressLocal, checkIndexerExists]);

  return {
    getWorldDeployedAddressLocal,
    checkIndexerExists,
    refreshStatuses,
  };
};

