import { blitzCommitment } from "@realms-world/value-ledger/commitment";
import { batchRemaining } from "@realms-world/value-ledger/shard";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import type { FinalizedGameSummary } from "./model";
import type { FinalizeGameRequest } from "./schemas";
import type { LaunchShard } from "./shard-client";

interface RankedPlayer {
  wallet: bigint;
  rank: number;
}
interface ResultProgress {
  players: readonly RankedPlayer[];
  complete: boolean;
  commitment: bigint;
}
export class GameNotEnded extends Error {
  constructor(readonly secondsUntilEnd: number) {
    super(`Game ends in ${secondsUntilEnd}s of chain time`);
  }
}
export interface ResultOperations {
  secondsUntilEnd(): Promise<number>;
  settle(): Promise<unknown>;
  progress(): Promise<ResultProgress>;
  players(): Promise<readonly { wallet: bigint; points: bigint }[]>;
  record(start: number, players: readonly RankedPlayer[]): Promise<unknown>;
}

/** Scores resolve through the immutable account/wallet roster; only frozen wallets and competition ranks are written. */
export async function completeBlitzResults(operations: ResultOperations): Promise<bigint> {
  const secondsUntilEnd = await operations.secondsUntilEnd();
  if (secondsUntilEnd > 0) throw new GameNotEnded(secondsUntilEnd);
  await operations.settle();
  let progress = await operations.progress();
  if (progress.complete) return progress.commitment;
  const players = rankPlayers(await operations.players());
  while (!progress.complete) {
    const start = progress.players.length;
    if (start >= players.length) throw new Error("Incomplete result has no remaining roster");
    await operations.record(start, players.slice(start, start + 8));
    const next = await operations.progress();
    if (next.players.length <= start) throw new Error("Result batch made no progress");
    progress = next;
  }
  return progress.commitment;
}
const rankPlayers = (players: readonly { wallet: bigint; points: bigint }[]): RankedPlayer[] => {
  const ordered = players.toSorted((a, b) =>
    a.points === b.points ? (a.wallet < b.wallet ? -1 : 1) : a.points > b.points ? -1 : 1,
  );
  let rank = 0;
  return ordered.map(({ wallet, points }, index) => {
    if (!index || ordered[index - 1]!.points !== points) rank = index + 1;
    return { wallet, rank };
  });
};

export const finalizeGame = async (request: FinalizeGameRequest, shard: LaunchShard): Promise<FinalizedGameSummary> => {
  const gameId = request.gameId;
  const commitment = await completeBlitzResults({
    secondsUntilEnd: async () => Number((await shard.game(gameId)).end_at) - (await shard.head()).timestamp,
    settle: async () => {
      while (!(await shard.game(gameId)).settled) {
        const result = await shard.play(gameId, [String(commandId("MarkGameSettled"))]);
        const remaining = batchRemaining(result.events, shard.target.gamesAddress, gameId, result.transactionHash);
        if (!remaining && !(await shard.game(gameId)).settled) throw new Error("point_settlement_not_complete");
      }
    },
    progress: () => shard.view<ResultProgress>("blitz_result", [gameId]),
    players: async () => {
      const roster = await shard.view<{ account: bigint; wallet: bigint }[]>("blitz_roster", [gameId]);
      return Promise.all(
        roster.map(async ({ account, wallet }) => ({
          wallet,
          points: await shard.view<bigint>("player_points", [gameId, account]),
        })),
      );
    },
    record: (start, players) =>
      shard.play(gameId, [
        String(commandId("RecordBlitzResults")),
        String(start),
        String(players.length),
        ...players.flatMap(({ wallet, rank }) => [String(wallet), String(rank)]),
      ]),
  });
  const result = await shard.view<ResultProgress>("blitz_result", [gameId]);
  if (
    !result.complete ||
    BigInt(blitzCommitment({ chainId: shard.target.chainId, gameId, rows: result.players })) !== commitment
  )
    throw new Error("shard_result_commitment_differs");
  return { ...request, resultCommitment: `0x${commitment.toString(16)}` };
};

// Only the canonical enum order is read here; the retired player/points payload ABI never encodes a ranked row.
const commandId = (name: string) => {
  const command = bindings.commandAbi.find((type) => type.type === "enum" && type.name.endsWith("::Command")) as
    | { variants: { name: string }[] }
    | undefined;
  const id = command?.variants.findIndex((variant) => variant.name === name) ?? -1;
  if (id < 0) throw new Error("native_command_not_published");
  return id;
};
