import { readGuildMembers, readGuildWhitelist } from "@bibliothecadao/eternum";
import type { ContractAddress } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "./use-native-facts";
import { getPlayerName } from "@/services/identity/player-profiles";
import { usePlayerNamesRevision } from "@/hooks/use-player-profile";

export const useGuildMembers = (guildId: ContractAddress) => {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const revision = useNativeRevision(["GuildMember"]);
  const names = usePlayerNamesRevision();
  return useMemo(
    () => readGuildMembers(store, guildId, BigInt(account.address), getPlayerName),
    [store, guildId, account.address, revision, ...names],
  );
};
export const useGuildWhitelist = (guildId: ContractAddress) => {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const revision = useNativeRevision(["GuildWhitelist"]);
  const names = usePlayerNamesRevision();
  return useMemo(
    () => readGuildWhitelist(store, BigInt(account.address), { guildId }, getPlayerName),
    [store, guildId, account.address, revision, ...names],
  );
};
export const usePlayerWhitelist = (player: ContractAddress) => {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const revision = useNativeRevision(["GuildWhitelist"]);
  const names = usePlayerNamesRevision();
  return useMemo(
    () => readGuildWhitelist(store, BigInt(account.address), { player }, getPlayerName),
    [store, player, account.address, revision, ...names],
  );
};
