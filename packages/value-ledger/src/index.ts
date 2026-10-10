import { ledgerInteger, ledgerBool as bool } from "./codecs";
export {
  ledgerInteger,
  ledgerBool,
  ledgerU256,
  decodeFrontierSeason,
  decodeLedgerPreset,
  decodeBlitzSeason,
  readConfirmedLedgerHead,
} from "./codecs";
import type { RpcProvider } from "starknet";
export { rpcAt } from "./rpc";
export interface LedgerGameKey {
  chainId: string;
  gameId: number;
}
interface LedgerGame {
  seasonId: number;
  presetId: number;
  start: number;
  end: number;
  registeredCount: number;
  registrationLimit: number;
  cancelled: boolean;
  finalized: boolean;
  commitment: string;
}

/** Published Game field order, read at one confirmed head for all roster entries. */
export async function readLedgerGame(
  provider: RpcProvider,
  address: string,
  key: LedgerGameKey,
  head: number,
): Promise<LedgerGame> {
  const fields = await provider.callContract(
    { contractAddress: address, entrypoint: "get_game", calldata: [key.chainId, String(key.gameId)] },
    head,
  );
  if (fields.length !== 12 || BigInt(fields[1]!) !== 1n) throw new Error("invalid_ledger_game");
  return {
    seasonId: ledgerInteger(fields[0]!),
    presetId: ledgerInteger(fields[2]!),
    start: ledgerInteger(fields[3]!),
    end: ledgerInteger(fields[4]!),
    registeredCount: ledgerInteger(fields[8]!),
    registrationLimit: ledgerInteger(fields[11]!),
    commitment: fields[7]!,
    cancelled: bool(fields[9]!),
    finalized: bool(fields[10]!),
  };
}

/** Recorded wallet/account pairs at one confirmed head; linkage changes cannot alter a paid seat. */
export async function readRegisteredPlayers(
  provider: RpcProvider,
  address: string,
  key: LedgerGameKey,
  head: number,
  count: number,
  limit: number,
): Promise<{ wallet: string; account: string }[]> {
  const players: { wallet: string; account: string }[] = [];
  if (
    !Number.isInteger(limit) ||
    limit <= 0 ||
    limit > 0xffff ||
    !Number.isInteger(count) ||
    count < 0 ||
    count > limit
  )
    throw new Error("unsupported_ledger_roster_size");
  for (let index = 0; index < count; index++) {
    const fields = await provider.callContract(
      {
        contractAddress: address,
        entrypoint: "get_registered_player",
        calldata: [key.chainId, String(key.gameId), String(index)],
      },
      head,
    );
    if (fields.length !== 2 || BigInt(fields[0]!) === 0n || BigInt(fields[1]!) === 0n)
      throw new Error("invalid_registered_player");
    players.push({ wallet: fields[0]!, account: fields[1]! });
  }
  return players;
}

export interface LedgerRosterSnapshot {
  gameId: number;
  blockNumber: number;
  blockHash: string;
  secondsUntilClose: number;
  end: number;
  registrations: readonly { wallet: string; account: string }[];
}

export { activeShards, requireActiveChain, readRegisteredShard } from "./official-shards";
export type { ShardDirectory, RegisteredShard } from "./official-shards";

export { computeSeasonTop } from "./season-top";
