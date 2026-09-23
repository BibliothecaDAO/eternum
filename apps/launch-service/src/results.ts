import { CallData, RpcProvider, type Abi } from "starknet";
import {
  completeNativeAdminCommand,
  executeNativeAdminCommand,
} from "../../../config/deployer/clean/world/native/command";
import { nativeGamesAbi } from "../../../config/deployer/clean/world/native/manifest";
import type { RegistrarWorld } from "../../../config/deployer/clean/world/native/types";
import type { NativeCommand } from "../../../packages/provider/src/native-command";
import type { FinalizedGameSummary } from "./model";
import type { FinalizeGameRequest } from "./schemas";

type PlayerResult = Extract<NativeCommand, { kind: "RecordBlitzResults" }>["value"]["players"][number];
interface ResultProgress {
  players: readonly PlayerResult[];
  complete: boolean;
  commitment: bigint;
}
interface ResultTarget {
  provider: RpcProvider;
  manifest: RegistrarWorld;
  admissionUrl: string;
  accountAddress: string;
  privateKey: string;
  gameId: number;
}

/** The job ran before the chain reached the game's end; the worker requeues it for that moment. */
export class GameNotEnded extends Error {
  constructor(readonly secondsUntilEnd: number) {
    super(`Game ends in ${secondsUntilEnd}s of chain time`);
  }
}

export interface ResultOperations {
  secondsUntilEnd(): Promise<number>;
  settle(): Promise<unknown>;
  progress(): Promise<ResultProgress>;
  players(): Promise<readonly { player: bigint; points: bigint }[]>;
  record(start: number, players: readonly PlayerResult[]): Promise<unknown>;
}

/** Chain progress owns retries, including a crash after a submitted batch landed. */
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

function rankPlayers(players: readonly { player: bigint; points: bigint }[]): PlayerResult[] {
  const ordered = players.toSorted((a, b) =>
    a.points === b.points ? (a.player < b.player ? -1 : 1) : a.points > b.points ? -1 : 1,
  );
  let rank = 0;
  return ordered.map((entry, index) => {
    if (index === 0 || ordered[index - 1].points !== entry.points) rank = index + 1;
    return { ...entry, rank };
  });
}

function view<T>(target: ResultTarget, entrypoint: string, calldata: (number | string | bigint)[]): Promise<T> {
  const abi: Abi = nativeGamesAbi(target.manifest);
  return target.provider
    .callContract(
      { contractAddress: target.manifest.world.address, entrypoint, calldata: calldata.map(String) },
      "latest",
    )
    .then((response) => new CallData(abi).parse(entrypoint, response) as T);
}

export async function finalizeGame(
  request: FinalizeGameRequest,
  rpc: { url: string; admissionUrl: string },
  credentials: { manifest: RegistrarWorld; accountAddress: string; privateKey: string },
): Promise<FinalizedGameSummary> {
  const target: ResultTarget = {
    ...credentials,
    admissionUrl: rpc.admissionUrl,
    gameId: request.gameId,
    provider: new RpcProvider({ nodeUrl: rpc.url }),
  };
  const commitment = await completeBlitzResults(resultOperations(target));
  return { ...request, resultCommitment: `0x${commitment.toString(16)}` };
}

function resultOperations(target: ResultTarget): ResultOperations {
  return {
    secondsUntilEnd: async () => {
      const game = await view<{ end_at: bigint; end_grace_seconds: bigint }>(target, "game", [target.gameId]);
      const block = await target.provider.getBlock("latest");
      return Number(game.end_at + game.end_grace_seconds) - block.timestamp;
    },
    settle: () => completeNativeAdminCommand({ ...target, command: { kind: "MarkGameSettled", value: undefined } }),
    progress: () => view<ResultProgress>(target, "blitz_result", [target.gameId]),
    players: async () => {
      const roster = await view<{ account: bigint }[]>(target, "blitz_roster", [target.gameId]);
      return Promise.all(
        roster.map(async ({ account }) => ({
          player: account,
          points: await view<bigint>(target, "player_points", [target.gameId, account]),
        })),
      );
    },
    record: (start, players) =>
      executeNativeAdminCommand({ ...target, command: { kind: "RecordBlitzResults", value: { start, players } } }),
  };
}
