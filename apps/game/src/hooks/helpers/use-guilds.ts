import { readGuildMembers, readGuildWhitelist } from "@bibliothecadao/eternum";
import type { ContractAddress } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "./use-native-facts";
import { usePlayerNames } from "@/hooks/use-player-profile";

export const useGuildMembers = (guildId: ContractAddress) => {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const revision = useNativeRevision(["GuildMember"]);
  const names = usePlayerNames();
  return useMemo(
    () => readGuildMembers(store, guildId, BigInt(account.address), names.text),
    [store, guildId, account.address, revision, names],
  );
};
export const useGuildWhitelist = (guildId: ContractAddress) => {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const revision = useNativeRevision(["GuildWhitelist"]);
  const names = usePlayerNames();
  return useMemo(
    () => readGuildWhitelist(store, BigInt(account.address), { guildId }, names.text),
    [store, guildId, account.address, revision, names],
  );
};
export const usePlayerWhitelist = (player: ContractAddress) => {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const revision = useNativeRevision(["GuildWhitelist"]);
  const names = usePlayerNames();
  return useMemo(
    () => readGuildWhitelist(store, BigInt(account.address), { player }, names.text),
    [store, player, account.address, revision, names],
  );
};
