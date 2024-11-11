import { ClientComponents } from "@/dojo/createClientComponents";
import { LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { ContractAddress, Player } from "@bibliothecadao/eternum";
import { ComponentValue, getComponentValue, Has, HasValue, NotValue, runQuery } from "@dojoengine/recs";
import { shortString } from "starknet";
import { useDojo } from "../context/DojoContext";
import useUIStore from "../store/useUIStore";
import { getAddressNameFromEntityIds, useEntitiesUtils } from "./useEntities";

export const useGetAllPlayers = () => {
  const {
    setup: {
      components: { Owner, AddressName },
    },
  } = useDojo();
  const nextBlockTimestamp = useUIStore.getState().nextBlockTimestamp;

  const playerEntities = runQuery([Has(AddressName)]);
  const playersByRank = LeaderboardManager.instance().getPlayersByRank(nextBlockTimestamp || 0);

  const getPlayers = (): Player[] => {
    const players = Array.from(Array.from(playerEntities))
      .map((id) => {
        const addressName = getComponentValue(AddressName, id);
        if (!addressName) return;

        const isAlive = !!runQuery([HasValue(Owner, { address: addressName.address })]).size;

        return { ...addressName, isAlive };
      })
      .filter(
        (player): player is ComponentValue<ClientComponents["AddressName"]["schema"]> & { isAlive: boolean } =>
          player !== undefined,
      );

    const lastRankedPosition = playersByRank.length;
    let unrankedCount = 0;

    return players.map((player) => {
      const rankIndex = playersByRank.findIndex(([address]) => address === player.address);
      if (rankIndex === -1) unrankedCount++;

      return {
        address: player.address,
        addressName: shortString.decodeShortString(player.name.toString()),
        rank: calculatePlayerRank(player.isAlive, rankIndex, lastRankedPosition, unrankedCount),
        points: rankIndex === -1 ? 0 : playersByRank[rankIndex][1],
      };
    });
  };

  return getPlayers;
};

export const useGetOtherPlayers = () => {
  const {
    account: { account },
    setup: {
      components: { Owner, Realm },
    },
  } = useDojo();
  const { getAddressNameFromEntity } = useEntitiesUtils();

  const playersEntityIds = runQuery([
    Has(Owner),
    Has(Realm),
    NotValue(Owner, { address: ContractAddress(account.address) }),
  ]);

  const getPlayers = (): Player[] => {
    const players = getAddressNameFromEntityIds(Array.from(playersEntityIds), Owner, getAddressNameFromEntity);

    const uniquePlayers = Array.from(new Map(players.map((player) => [player.address, player])).values());

    return uniquePlayers;
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
