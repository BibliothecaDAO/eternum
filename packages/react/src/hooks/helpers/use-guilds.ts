import {
  guildMembersQuery,
  guildWhitelistQuery,
  playerWhitelistQuery,
  readGuildMembers,
  readGuildWhitelist,
} from "@bibliothecadao/eternum";
import { ContractAddress } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context";

export const useGuildMembers = (guildEntityId: ContractAddress) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const memberEntities = useEntityQuery(guildMembersQuery(components, guildEntityId));

  return readGuildMembers(components, memberEntities, ContractAddress(account.address));
};

export const useGuildWhitelist = (guildEntityId: ContractAddress) => {
  const {
    setup: { components },
  } = useDojo();

  const whitelistEntities = useEntityQuery(guildWhitelistQuery(components, guildEntityId));

  return readGuildWhitelist(components, whitelistEntities);
};

export const usePlayerWhitelist = (playerAddress: ContractAddress) => {
  const {
    setup: { components },
  } = useDojo();

  const whitelistEntities = useEntityQuery(playerWhitelistQuery(components, playerAddress));

  return readGuildWhitelist(components, whitelistEntities);
};
