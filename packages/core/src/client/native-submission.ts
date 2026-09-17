import { CallData, hash, type AccountInterface } from "starknet";
import type { NativeWorldBindings } from "@bibliothecadao/types";
import { frameNativeIntent, nativeTaggedHash, type NativeSubmission } from "@bibliothecadao/provider";
export { createNativeTicketSubmission } from "@bibliothecadao/provider";
import type { SignedNativeIntent } from "@bibliothecadao/provider";
import type { NativeFactStore } from "./native-fact-store";

export interface NativeClientConnection {
  bindings: NativeWorldBindings;
  chainId: string;
  /** Signs with the connected player's existing gameplay key. */
  signIntent(actor: AccountInterface, digest: string): Promise<{ r: bigint; s: bigint; publicKey: bigint }>;
  /** Acceptance time and entropy are assigned only by the sequencing service. */
  submitIntent(action: SignedNativeIntent): Promise<{ transaction_hash: string }>;
}

export function nativeSubmission(
  input: NativeClientConnection,
  store: NativeFactStore,
  gameId: number,
  season: string,
  prepareNonce?: (actor: string) => Promise<void>,
): NativeSubmission {
  const codec = new CallData(input.bindings.commandAbi);
  return async (actor, calls) => {
    const batch = Array.isArray(calls) ? calls : [calls];
    if (batch.length !== 1) throw new Error("Native execution accepts one command per action");
    const call = batch[0];
    if (BigInt(call.contractAddress) !== BigInt(season) || !Array.isArray(call.calldata))
      throw new Error("Invalid native command target");
    const [scope, ...arguments_] = call.calldata as string[];
    if (BigInt(scope) !== BigInt(gameId)) throw new Error("Native command game mismatch");
    const commands = input.bindings.commandAbi.find(
      (type) => type.type === "enum" && type.name === "world_native::commands::Command",
    );
    if (!commands || commands.variants[Number(arguments_[0])]?.name !== call.entrypoint)
      throw new Error("Native command discriminant mismatch");
    if (!store.get("ActionNonce", { game_id: gameId, actor: BigInt(actor.address) }))
      await prepareNonce?.(actor.address);
    const timestamp = Math.floor(Date.now() / 1_000);
    const encoded = frameNativeIntent({
      chain: input.chainId,
      deployment: season,
      gameId,
      actor: actor.address,
      nonce: nextNonce(store, gameId, actor.address),
      rules: nativeTaggedHash(
        "ETERNUM_RULES",
        codec.compile("rules_commitment", { rules: store.require("SliceRules", { game_id: gameId }) }),
      ),
      validFrom: 0,
      validUntil: timestamp + 300,
      lastOrder: 0xffffffffffffffffn,
      arguments: arguments_,
    });
    const signature = await input.signIntent(actor, hash.computePoseidonHashOnElements(encoded));
    return input.submitIntent({
      intent: encoded,
      r: `0x${signature.r.toString(16)}`,
      s: `0x${signature.s.toString(16)}`,
      public_key: `0x${signature.publicKey.toString(16)}`,
    });
  };
}

function nextNonce(store: NativeFactStore, gameId: number, actor: string): bigint {
  return store.require("ActionNonce", { game_id: gameId, actor: BigInt(actor) }).next_nonce;
}
