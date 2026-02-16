import { ContractAddress, HexEntityInfo, ID } from "@bibliothecadao/types";

interface ResolveArmyOccupancyAtContractHexInput {
  armyHexes: Map<number, Map<number, HexEntityInfo>>;
  contractCol: number;
  contractRow: number;
  feltCenter: number;
  selectedArmyId: ID;
  playerAddress: ContractAddress;
}

export function resolveArmyOccupancyAtContractHex(input: ResolveArmyOccupancyAtContractHexInput): {
  hasArmy: boolean;
  isArmyMine: boolean;
  isSelfArmy: boolean;
} {
  const normalizedCol = input.contractCol - input.feltCenter;
  const normalizedRow = input.contractRow - input.feltCenter;
  const occupyingArmy = input.armyHexes.get(normalizedCol)?.get(normalizedRow);

  if (!occupyingArmy) {
    return { hasArmy: false, isArmyMine: false, isSelfArmy: false };
  }

  const isSelfArmy = String(occupyingArmy.id) === String(input.selectedArmyId);
  if (isSelfArmy) {
    return { hasArmy: false, isArmyMine: false, isSelfArmy: true };
  }

  return {
    hasArmy: true,
    isArmyMine: occupyingArmy.owner === input.playerAddress,
    isSelfArmy: false,
  };
}
