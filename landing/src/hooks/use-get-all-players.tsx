import { Player } from "@/components/modules/leaderboard-panel";
import { LeaderboardManager } from "@/dojo/modelManager/leaderboard/LeaderboardManager";
import { StructureType } from "@bibliothecadao/eternum";
import { getComponentValue, Has, HasValue, runQuery } from "@dojoengine/recs";
import { shortString } from "starknet";
import { useDojo } from "./context/DojoContext";

export const useGetAllPlayers = () => {
  const {
    setup: {
      components: { Realm, Owner, AddressName, Hyperstructure, Structure },
    },
  } = useDojo();
  const nextBlockTimestamp = Math.floor(Date.now() / 1000);

  const playerEntities = runQuery([Has(AddressName)]);
  const playersByRank = LeaderboardManager.instance().getPlayersByRank(nextBlockTimestamp || 0);

  const totalPoints = playersByRank.reduce((sum, [, points]) => sum + points, 0);

  const getPlayers = (): Player[] => {
    const players = Array.from(Array.from(playerEntities))
      .map((id) => {
        const addressName = getComponentValue(AddressName, id);
        if (!addressName) return;

        const isAlive = !!runQuery([HasValue(Owner, { address: addressName.address })]).size;

        return {
          address: addressName.address,
          addressName: shortString.decodeShortString(addressName.name.toString()),
          isAlive,
        };
      })
      .filter((player) => player !== undefined);

    const lastRankedPosition = playersByRank.length;
    let unrankedCount = 0;

    return players.map((player) => {
      const rankIndex = playersByRank.findIndex(([address]) => address === player.address);
      if (rankIndex === -1) unrankedCount++;

      const points = rankIndex === -1 ? 0 : playersByRank[rankIndex][1];

      return {
        name: player.addressName,
        rank: calculatePlayerRank(player.isAlive, rankIndex, lastRankedPosition, unrankedCount),
        points,
        percentage: calculatePlayerSharePercentage(points, totalPoints),
        lords: calculateLordsShare(points, totalPoints),
        realms: runQuery([Has(Realm), HasValue(Owner, { address: player.address })]).size,
        mines: runQuery([
          HasValue(Structure, { category: StructureType[StructureType.FragmentMine] }),
          HasValue(Owner, { address: player.address }),
        ]).size,
        hyperstructures: runQuery([Has(Hyperstructure), HasValue(Owner, { address: player.address })]).size,
        isAlive: player.isAlive,
      };
    });
  };

  return getPlayers;
};

const calculatePlayerRank = (
  isAlive: boolean,
  rankIndex: number,
  lastRankedPosition: number,
  unrankedCount: number,
): number => {
  if (!isAlive) return Number.MAX_SAFE_INTEGER;
  if (rankIndex === -1) return lastRankedPosition + unrankedCount;
  return rankIndex + 1;
};

const calculateLordsShare = (points: number, totalPoints: number): number => {
  const TOTAL_LORDS_PRIZE = 1000000; // 1M LORDS in prize pool

  if (totalPoints === 0) return 0;

  const playerShare = (points / totalPoints) * TOTAL_LORDS_PRIZE;
  return Math.floor(playerShare);
};

const calculatePlayerSharePercentage = (points: number, totalPoints: number): number => {
  if (totalPoints === 0) return 0;

  return Math.floor((points / totalPoints) * 100);
};
