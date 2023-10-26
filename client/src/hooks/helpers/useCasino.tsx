import { Has, HasValue, getComponentValue, runQuery } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { Position, UIPosition } from "../../types";
import casinoData from "../../data/casinos.json";
import { getContractPositionFromRealPosition, getEntityIdFromKeys } from "../../utils/utils";

export interface CasinoInterface {
  casinoId: number;
  count: number;
  currentRoundId: number;
  progress: number;
  casinoCurrentRoundResources: {
    resourceId: number;
    currentAmount: number;
    completeAmount: number;
  }[];
  minimumDepositResources: {
    resourceId: number;
    amount: number;
  }[];
  position: Position;
  uiPosition: UIPosition;
}

export interface CasinoRoundInterface {
  roundIndex: number;
  winnerId: number;
  participantCount: number;
}

export const useCasino = () => {
  const {
    setup: {
      components: { CasinoMetaData, Resource, Position, CasinoRound },
    },
  } = useDojo();

  const getCasino = (count: number, uiPosition: UIPosition): CasinoInterface | undefined => {
    const position = getContractPositionFromRealPosition({ x: uiPosition.x, y: uiPosition.z });
    const casinoMetaDatas = runQuery([Has(CasinoMetaData), HasValue(Position, { x: position.x, y: position.y })]);
    if (casinoMetaDatas.size > 0) {
      let casinoId = Array.from(casinoMetaDatas)[
        Array.from(casinoMetaDatas).length - 1
      ];

      let casino = getComponentValue(CasinoMetaData, casinoId);

      if (casino) {
        let casinoCurrentRoundResources: { resourceId: number; currentAmount: number; completeAmount: number }[] = [];
        casinoData[count - 1].resources.minimum_completion.forEach((resource) => {
          let casinoRoundResource = getComponentValue(
            Resource,
            getEntityIdFromKeys([BigInt(casino.current_round_id), BigInt(resource.resourceType)]),
          );
          casinoCurrentRoundResources.push({
            resourceId: resource.resourceType,
            currentAmount: casinoRoundResource?.balance ?? 0,
            completeAmount: resource.amount,
          });
        });

        // calculate casino round progress
        let totCurrentAmount = 0;
        let totCompleteAmount = 0;
        casinoCurrentRoundResources.forEach((resource) => {
          totCurrentAmount += Math.min(resource.currentAmount, resource.completeAmount);
          totCompleteAmount += resource.completeAmount;
        });
        let progress = (totCurrentAmount / totCompleteAmount) * 100;

        return {
          casinoId,
          count,
          currentRoundId: casino.current_round_id,
          progress,
          casinoCurrentRoundResources,
          minimumDepositResources: casinoData[count - 1].resources.minimum_deposit.map((resource) => {
            return {
              resourceId: resource.resourceType, // Fixed: changed semicolon to comma
              amount: resource.amount,
            };
          }),
          position,
          uiPosition,
        };
      }
    }
  };



  const getCasinoRounds = (): Array<CasinoRoundInterface | undefined> | undefined => {
    const casinoRounds = runQuery([Has(CasinoRound)]);
    let result = [];
    for (let i = 0; i < casinoRounds.size; i++) {
      let casinoRoundId = Array.from(casinoRounds)[i]

      let casinoRound = getComponentValue(CasinoRound, casinoRoundId);

      result.push({
        roundIndex: casinoRound.round_index,
        winnerId: casinoRound.winner_id,
        participantCount: casinoRound.participant_count,
      })
    }

    // sort the result by round index
    result.sort((a, b) => a?.roundIndex - b?.roundIndex);

    return result;
  };

  return {
    getCasino,
    getCasinoRounds,
  };
};