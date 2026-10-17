import type { NativeWorldBindings } from "@bibliothecadao/types";
import type { NativeSubmission } from "@bibliothecadao/provider";
import type { GameSyncRuntime } from "../sync/game-sync-runtime";
import type { NativeFactStore } from "./native-fact-store";
import { executeGameplayAccountTransaction, type GameplayShard, type SendStage } from "./submit";

/**
 * A game command as the shard takes it: one Games.play call carrying the game, its current release pins and the command
 * (its discriminant and typed payload) as a span, signed and sent by the player's own account through the gameplay
 * submit: the nonce it numbers, the shard's bounds, up to PLAYS_IN_FLIGHT sends at once, and Herald-first bounded
 * reconciliation.
 */
export function nativePlay(
  input: {
    bindings: NativeWorldBindings;
    release: { ready(): Promise<void> };
    shard: GameplayShard;
    stopped: AbortSignal;
    runtime: Pick<GameSyncRuntime, "recordSubmittedTransaction" | "waitForTransaction">;
    /** Told each stage of each send, numbered from 1 in the order this client was handed them; once per stage. */
    onSendStage?: (send: number, stage: SendStage, detail?: string, transactionHash?: string) => void;
  },
  store: NativeFactStore,
  gameId: number,
  games: string,
): NativeSubmission {
  let sends = 0;
  return async (actor, calls) => {
    const send = ++sends;
    const reached = new Set<SendStage>();
    // The first word on a stage stands: a play seen included answers it even if the proxy's reply comes after.
    const stage = (name: SendStage, detail?: string, transactionHash?: string) => {
      if (reached.has(name)) return;
      reached.add(name);
      input.onSendStage?.(send, name, detail, transactionHash);
    };
    stage("command");
    try {
      const sent = await sendCommand(actor, calls, stage);
      void sent.inBlock.then(
        () => stage("settled", undefined, sent.transaction_hash),
        (error: unknown) => stage("settled", errorName(error), sent.transaction_hash),
      );
      return sent;
    } catch (error) {
      stage("settled", errorName(error));
      throw error;
    }
  };

  async function sendCommand(
    actor: Parameters<NativeSubmission>[0],
    calls: Parameters<NativeSubmission>[1],
    stage: (name: SendStage, detail?: string, transactionHash?: string) => void,
  ) {
    const batch = Array.isArray(calls) ? calls : [calls];
    if (batch.length !== 1) throw new Error("Native execution accepts one command per action");
    const call = batch[0];
    if (BigInt(call.contractAddress) !== BigInt(games) || !Array.isArray(call.calldata))
      throw new Error("Invalid native command target");
    const [scope, ...command] = call.calldata as string[];
    if (BigInt(scope) !== BigInt(gameId)) throw new Error("Native command game mismatch");
    const commands = input.bindings.commandAbi.find(
      (type) => type.type === "enum" && type.name === "world_native::commands::Command",
    );
    if (!commands || commands.variants[Number(command[0])]?.name !== call.entrypoint)
      throw new Error("Native command discriminant mismatch");
    await input.release.ready();
    stage("release-ready");
    const release = store.require("GameRelease", { game_id: gameId });
    const { transaction_hash, inBlock } = await executeGameplayAccountTransaction({
      account: actor,
      shard: input.shard,
      stopped: input.stopped,
      waitForTransaction: (hash) => {
        input.runtime.recordSubmittedTransaction(hash);
        return input.runtime.waitForTransaction(hash);
      },
      onStage: stage,
      calls: {
        contractAddress: games,
        entrypoint: "play",
        calldata: [
          String(gameId),
          String(release.release_id),
          String(release.preset_commitment),
          String(command.length),
          ...command,
        ],
      },
    });
    return { transaction_hash, inBlock };
  }
}

const errorName = (error: unknown): string => (error instanceof Error ? error.name : "Error");
