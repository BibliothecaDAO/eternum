import { blitzCommitment, blitzResultFields } from "@realms-world/value-ledger/commitment";
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
  record(): Promise<unknown>;
}

/** Final points and the immutable ranked result are both computed by the shard. */
export async function completeBlitzResults(operations: ResultOperations): Promise<bigint> {
  const secondsUntilEnd = await operations.secondsUntilEnd();
  if (secondsUntilEnd > 0) throw new GameNotEnded(secondsUntilEnd);
  await operations.settle();
  const progress = await operations.progress();
  if (progress.complete) return progress.commitment;
  await operations.record();
  const result = await operations.progress();
  if (!result.complete) throw new Error("result_not_complete");
  return result.commitment;
}

export const finalizeGame = async (request: FinalizeGameRequest, shard: LaunchShard): Promise<FinalizedGameSummary> => {
  const gameId = request.gameId;
  const commitment = await completeBlitzResults({
    secondsUntilEnd: async () => Number((await shard.game(gameId)).end_at) - (await shard.head()).timestamp,
    settle: () => shard.settleGame(gameId),
    progress: () => gameResult(shard, gameId),
    record: () => shard.playCommand(gameId, "RecordBlitzResults"),
  });
  const result = await gameResult(shard, gameId);
  if (
    !result.complete ||
    BigInt(blitzCommitment({ chainId: shard.target.chainId, gameId, rows: result.players })) !== commitment
  )
    throw new Error("shard_result_commitment_differs");
  return { ...request, resultCommitment: `0x${commitment.toString(16)}` };
};

export const gameResult = async (shard: Pick<LaunchShard, "view">, gameId: number): Promise<ResultProgress> => {
  const fields = blitzResultFields((await shard.view<bigint[]>("game_result", [gameId])).map(String));
  return {
    players: fields.rows.map(({ wallet, rank }) => ({ wallet: BigInt(wallet), rank: Number(rank) })),
    complete: BigInt(fields.complete) === 1n,
    commitment: BigInt(fields.commitment),
  };
};
