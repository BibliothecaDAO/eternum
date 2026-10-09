import type { NativeWorldBindings } from "@bibliothecadao/types";
import type { NativeSubmission } from "@bibliothecadao/provider";
import type { NativeFactStore } from "./native-fact-store";

/**
 * A game command as the shard takes it: one Games.play call carrying the game, its current release pins and the command
 * (its discriminant and typed payload) as a span, signed and sent by the player's own account. The account's configured
 * submit (configureGameplayAccountSubmits) gives it the current nonce, the shard's bounds and one send in flight.
 */
export function nativePlay(
  input: { bindings: NativeWorldBindings; release: { ready(): Promise<void> } },
  store: NativeFactStore,
  gameId: number,
  games: string,
): NativeSubmission {
  return async (actor, calls) => {
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
    const release = store.require("GameRelease", { game_id: gameId });
    const { transaction_hash } = await actor.execute({
      contractAddress: games,
      entrypoint: "play",
      calldata: [
        String(gameId),
        String(release.release_id),
        String(release.preset_commitment),
        String(command.length),
        ...command,
      ],
    });
    return { transaction_hash };
  };
}
