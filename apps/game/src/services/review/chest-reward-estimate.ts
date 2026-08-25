const VICTORY_POINTS_MULTIPLIER = 1_000_000n;
const GAME_REWARD_CHEST_POINTS_THRESHOLD = 500n * VICTORY_POINTS_MULTIPLIER;

interface ClaimableChestEstimateInput {
  lootChestAddress: string | null;
  allocatedChests: number;
  distributedChests: number;
  playerRegisteredPoints: bigint;
  totalRegisteredPoints: bigint;
}

interface ClaimableChestEstimate {
  count: number;
  reason: string;
}

const calculateProportionalChestShare = ({
  allocatedChests,
  distributedChests,
  playerRegisteredPoints,
  totalRegisteredPoints,
}: Omit<ClaimableChestEstimateInput, "lootChestAddress">): number => {
  if (allocatedChests <= 0 || totalRegisteredPoints <= 0n) {
    return 0;
  }

  const rawShare = Number((BigInt(allocatedChests) * playerRegisteredPoints) / totalRegisteredPoints);
  const remainingAllocatedChests = Math.max(0, allocatedChests - distributedChests);
  return Math.min(rawShare, remainingAllocatedChests);
};

export const estimateClaimableChests = ({
  lootChestAddress,
  allocatedChests,
  distributedChests,
  playerRegisteredPoints,
  totalRegisteredPoints,
}: ClaimableChestEstimateInput): ClaimableChestEstimate => {
  if (!lootChestAddress) {
    return {
      count: 0,
      reason: "Loot chest rewards are not configured for this game.",
    };
  }

  const guaranteedChestBonus = playerRegisteredPoints >= GAME_REWARD_CHEST_POINTS_THRESHOLD ? 1 : 0;
  const proportionalChestShare = calculateProportionalChestShare({
    allocatedChests,
    distributedChests,
    playerRegisteredPoints,
    totalRegisteredPoints,
  });

  return {
    count: Math.max(0, guaranteedChestBonus + proportionalChestShare),
    reason: "",
  };
};
