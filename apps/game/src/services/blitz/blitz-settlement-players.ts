import { configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

export const filterPlayersByBlitzSettlement = <Player extends { address: bigint }>(
  players: readonly Player[],
  settledPlayerAddresses: readonly bigint[],
): Player[] => {
  const settledPlayers = new Set(settledPlayerAddresses);
  return players.filter((player) => settledPlayers.has(player.address));
};

export const readBlitzSettlementPlayerAddresses = (store: NativeFactStore): bigint[] =>
  [...store.inGame("PlayerEntry", configManager.getActiveGameId())].map((entry) => entry.player);
