import { ContractAddress } from "@bibliothecadao/types";

export interface ContractAddressAndAmount {
  address: ContractAddress;
  percentage: number;
}

export interface HyperstructureShareholder {
  hyperstructure_id: number;
  start_at: number;
  shareholders: ContractAddressAndAmount[];
}

export interface HyperstructureLeaderboardHyperstructure {
  hyperstructure_id: number;
  points_multiplier: number;
  realm_count: number;
}

export interface CalculateUnregisteredShareholderPointsCacheOptions {
  pointsPerSecondWithoutMultiplier: number;
  realmCountPerHyperstructures?: Map<number, number>;
  seasonEnd: number;
  hyperstructureShareholders: HyperstructureShareholder[];
  hyperstructures: HyperstructureLeaderboardHyperstructure[];
}

/**
 * Calculate total unregistered shareholder points per player across all hyperstructures.
 */
export const calculateUnregisteredShareholderPointsCache = ({
  pointsPerSecondWithoutMultiplier,
  realmCountPerHyperstructures,
  seasonEnd,
  hyperstructureShareholders,
  hyperstructures,
}: CalculateUnregisteredShareholderPointsCacheOptions): Map<ContractAddress, number> => {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const seasonHasEnded = seasonEnd > 0 && nowInSeconds >= seasonEnd;
  const currentTimestamp = seasonHasEnded ? seasonEnd : nowInSeconds;

  const cache = new Map<ContractAddress, number>();

  for (const hyperstructureShareholder of hyperstructureShareholders) {
    if (!hyperstructureShareholder) continue;

    const hyperstructure = hyperstructures.find(
      (item) => item.hyperstructure_id === hyperstructureShareholder.hyperstructure_id,
    );

    const hyperstructureId = Number(hyperstructureShareholder.hyperstructure_id ?? 0);

    const pointsMultiplier = hyperstructure ? Number(hyperstructure.points_multiplier ?? 1) : 1;
    const realmCount = realmCountPerHyperstructures?.get(hyperstructureId) ?? hyperstructure?.realm_count ?? 0;

    const pointsPerSecond =
      hyperstructure && realmCount > 0 ? pointsPerSecondWithoutMultiplier * pointsMultiplier * realmCount : 0;
    if (pointsPerSecond === 0) continue;

    const shareholders = hyperstructureShareholder.shareholders;
    const startTimestamp = Number(hyperstructureShareholder.start_at);
    if (startTimestamp === 0) continue;

    const timeElapsed = Math.max(0, currentTimestamp - startTimestamp);
    const playerShareholderPercentages = new Map<ContractAddress, number>();

    for (const share of shareholders) {
      const playerAddress = share.address;
      const shareholderPercentage = share.percentage;
      if (shareholderPercentage <= 0) continue;

      const existingPercentage = playerShareholderPercentages.get(playerAddress) || 0;
      playerShareholderPercentages.set(playerAddress, existingPercentage + shareholderPercentage);
    }

    for (const [playerAddress, totalShareholderPercentage] of playerShareholderPercentages) {
      const hyperstructurePoints = Math.floor(pointsPerSecond * totalShareholderPercentage * timeElapsed);
      if (hyperstructurePoints === 0) continue;

      const existingTotal = cache.get(playerAddress) || 0;
      cache.set(playerAddress, existingTotal + hyperstructurePoints);
    }
  }

  return cache;
};
