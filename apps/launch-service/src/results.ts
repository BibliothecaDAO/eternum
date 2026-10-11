import { blitzCommitment } from "@realms-world/value-ledger/commitment";
import { batchRemaining } from "@realms-world/value-ledger/shard";
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
    settle: async () => {
      while (!(await shard.game(gameId)).settled) {
        const result = await shard.playCommand(gameId, "MarkGameSettled");
        const remaining = batchRemaining(result.events, shard.target.gamesAddress, result.transactionHash, {
          gameId,
          missing: "reject",
        });
        if (!remaining && !(await shard.game(gameId)).settled) throw new Error("point_settlement_not_complete");
      }
    },
    progress: () => shard.view<ResultProgress>("blitz_result", [gameId]),
    record: () => shard.playCommand(gameId, "RecordBlitzResults"),
  });
  const result = await shard.view<ResultProgress>("blitz_result", [gameId]);
  if (
    !result.complete ||
    BigInt(blitzCommitment({ chainId: shard.target.chainId, gameId, rows: result.players })) !== commitment
  )
    throw new Error("shard_result_commitment_differs");
  return { ...request, resultCommitment: `0x${commitment.toString(16)}` };
};
