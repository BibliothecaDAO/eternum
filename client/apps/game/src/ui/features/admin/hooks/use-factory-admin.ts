import { useCallback } from "react";
import type { ChainType } from "../utils/manifest-loader";
import {
  checkBanksExist as checkBanksExistService,
  checkIndexerExists as checkIndexerExistsService,
  getWorldDeployedAddress as getWorldDeployedAddressService,
} from "../services/factory-indexer";
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

  const checkBanksExist = useCallback(async (worldName: string, expectedCount: number) => {
    return checkBanksExistService(worldName, expectedCount);
  }, []);

  const refreshStatuses = useCallback(
    async (worldNames: string[], opts?: { checkBanks?: boolean; bankCount?: number }) => {
      const statusPromises = worldNames.map(async (worldName) => {
        const [indexerExists, deployedAddress] = await Promise.all([
          checkIndexerExists(worldName),
          getWorldDeployedAddressLocal(worldName),
        ]);
        // Only check banks if requested and indexer is available
        let banksExist = false;
        if (opts?.checkBanks && indexerExists) {
          banksExist = await checkBanksExist(worldName, opts.bankCount ?? 6);
        }
        return { worldName, indexerExists, isDeployed: !!deployedAddress, deployedAddress, banksExist };
      });

      const results = await Promise.all(statusPromises);
      const indexerStatusMap: Record<string, boolean> = {};
      const deployedStatusMap: Record<string, boolean> = {};
      const bankStatusMap: Record<string, boolean> = {};
      results.forEach(({ worldName, indexerExists, isDeployed, deployedAddress, banksExist }) => {
        indexerStatusMap[worldName] = indexerExists;
        deployedStatusMap[worldName] = isDeployed;
        bankStatusMap[worldName] = banksExist;
        if (deployedAddress) cacheDeployedAddress(worldName, deployedAddress);
      });
      return { indexerStatusMap, deployedStatusMap, bankStatusMap };
    },
    [getWorldDeployedAddressLocal, checkIndexerExists, checkBanksExist],
  );

  return {
    getWorldDeployedAddressLocal,
    checkIndexerExists,
    checkBanksExist,
    refreshStatuses,
  };
};
