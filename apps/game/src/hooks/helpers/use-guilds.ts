import { readGuildMembers, readGuildWhitelist } from "@bibliothecadao/eternum";
import type { ContractAddress } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeFacts } from "./use-native-facts";
import { usePlayerNames } from "@/hooks/use-player-profile";

export const useGuildMembers = (guildId: ContractAddress) => {
  const {
    account: { account },
  } = useGame();
  const facts = useNativeFacts(["GuildMember"]);
  const names = usePlayerNames();
  return useMemo(
    () => readGuildMembers(facts.store, guildId, BigInt(account.address), names.text),
    [facts, guildId, account.address, names],
  );
};
export const useGuildWhitelist = (guildId: ContractAddress) => {
  const {
    account: { account },
  } = useGame();
  const facts = useNativeFacts(["GuildWhitelist"]);
  const names = usePlayerNames();
  return useMemo(
    () => readGuildWhitelist(facts.store, BigInt(account.address), { guildId }, names.text),
    [facts, guildId, account.address, names],
  );
};
export const usePlayerWhitelist = (player: ContractAddress) => {
  const {
    account: { account },
  } = useGame();
  const facts = useNativeFacts(["GuildWhitelist"]);
  const names = usePlayerNames();
  return useMemo(
    () => readGuildWhitelist(facts.store, BigInt(account.address), { player }, names.text),
    [facts, player, account.address, names],
  );
};
