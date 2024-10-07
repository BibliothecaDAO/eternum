import { ContractAddress } from "@bibliothecadao/eternum";
import { Has, NotValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";
import { getAddressNameFromEntityIds, getEntitiesUtils } from "./useEntities";

export const useGetAllPlayers = () => {
  const {
    account: { account },
    setup: {
      components: { Owner, Realm },
    },
  } = useDojo();

  const { getAddressNameFromEntity } = getEntitiesUtils();

  const playersEntityIds = runQuery([
    Has(Owner),
    Has(Realm),
    NotValue(Owner, { address: ContractAddress(account.address) }),
  ]);

  const getPlayers = () => {
    const players = getAddressNameFromEntityIds(Array.from(playersEntityIds), Owner, getAddressNameFromEntity);

    const uniquePlayers = Array.from(new Map(players.map((player) => [player.address, player])).values());

    return uniquePlayers;
  };

  return getPlayers;
};
