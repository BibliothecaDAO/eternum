import { useQuery } from "@tanstack/react-query";

import type { PaidGameLedger } from "@realms-world/identity";

import { ledgerOf } from "./game-entry";

/*
 * Value on the ledger belongs to the wallet that paid: a game's registration, result, chest and refund, and a season's
 * share, are all keyed by it (ledger-interface.txt). The account's payout wallet of today is not that wallet once the
 * player has replaced it, so every paid read and send goes through the wallet the game's registrations name.
 */

const sameAddress = (one: string, other: string) => BigInt(one) === BigInt(other);

/** The wallet that paid this account's seat in a game, from the game's registrations; null if it holds none. */
export const payingWalletOf = async (ledger: PaidGameLedger, account: string): Promise<string | null> => {
  const read = ledgerOf(ledger);
  const { registeredCount } = await read.game(ledger);
  const players = await Promise.all(
    Array.from({ length: registeredCount }, (_, index) => read.registeredPlayer(ledger, index)),
  );
  return players.find((player) => sameAddress(player.account, account))?.wallet ?? null;
};

export const payingWalletKey = (ledger: PaidGameLedger, account: string) =>
  ["ledger", "payer", ledger.address, ledger.shard, ledger.gameId, account] as const;

/**
 * The wallet that paid for `account` in a game. A registration never moves, so once found it is not read again; until
 * then it is read again as the seats fill.
 */
export const usePayingWallet = (ledger: PaidGameLedger | null, account: string | null) =>
  useQuery({
    queryKey: ledger && account ? payingWalletKey(ledger, account) : (["ledger", "payer", "none"] as const),
    queryFn: () => payingWalletOf(ledger as PaidGameLedger, account as string),
    enabled: ledger !== null && account !== null,
    staleTime: (query) => (query.state.data ? Infinity : 0),
    refetchInterval: (query) => (query.state.data ? false : 15_000),
  });
