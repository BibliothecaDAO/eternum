import { readGuildMembers, readGuildWhitelist } from "@bibliothecadao/eternum";
import type { ContractAddress } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "./use-native-facts";

export const useGuildMembers = (guildId: ContractAddress) => {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const revision = useNativeRevision(["GuildMember", "AddressName"]);
  return useMemo(
    () => readGuildMembers(store, guildId, BigInt(account.address)),
    [store, guildId, account.address, revision],
  );
};
export const useGuildWhitelist = (guildId: ContractAddress) => {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const revision = useNativeRevision(["GuildWhitelist", "AddressName"]);
  return useMemo(
    () => readGuildWhitelist(store, BigInt(account.address), { guildId }),
    [store, guildId, account.address, revision],
  );
};
export const usePlayerWhitelist = (player: ContractAddress) => {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const revision = useNativeRevision(["GuildWhitelist", "AddressName"]);
  return useMemo(
    () => readGuildWhitelist(store, BigInt(account.address), { player }),
    [store, player, account.address, revision],
  );
};
