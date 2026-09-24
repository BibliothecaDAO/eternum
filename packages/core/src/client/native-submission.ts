import { CallData, hash, type AccountInterface } from "starknet";
import type { NativeWorldBindings } from "@bibliothecadao/types";
import { frameNativeIntent, nativeTaggedHash, type NativeSubmission } from "@bibliothecadao/provider";
export { createNativeTicketSubmission, signGameplayIntent } from "@bibliothecadao/provider";
import type { SignedNativeIntent } from "@bibliothecadao/provider";
import type { NativeFactStore } from "./native-fact-store";

export interface NativeClientConnection {
  bindings: NativeWorldBindings;
  chainId: string;
  /** Signs with the connected player's existing gameplay key. */
  signIntent(actor: AccountInterface, digest: string): Promise<string[]>;
  /** Acceptance time and entropy are assigned only by the sequencing service. */
  submitIntent: ((action: SignedNativeIntent) => Promise<{ transaction_hash: string; order: bigint }>) & {
    dispose?: () => void;
  };
}

export function nativeSubmission(
  input: NativeClientConnection,
  store: NativeFactStore,
  gameId: number,
  season: string,
  prepareNonce?: (actor: string) => Promise<void>,
): NativeSubmission {
  const codec = new CallData(input.bindings.commandAbi);
  const readNonce = createNonceReader(store, gameId, prepareNonce);
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
    const nonce = await readNonce(actor.address);
    const timestamp = Math.floor(Date.now() / 1_000);
    const encoded = frameNativeIntent({
      chain: input.chainId,
      deployment: season,
      gameId,
      actor: actor.address,
      nonce,
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
    const submitted = await input.submitIntent({ intent: encoded, signature });
    return {
      transaction_hash: submitted.transaction_hash,
      ticket: {
        gameId: String(gameId),
        actor: actor.address,
        nonce: nonce.toString(),
        order: submitted.order.toString(),
      },
    };
  };
}

function nextNonce(store: NativeFactStore, gameId: number, actor: string): bigint {
  return store.require("ActionNonce", { game_id: gameId, actor: BigInt(actor) }).next_nonce;
}

/** Only missing actor snapshots share a transport; signing and submission remain concurrent. */
function createNonceReader(
  store: NativeFactStore,
  gameId: number,
  prepareNonce?: (actor: string) => Promise<void>,
): (actor: string) => bigint | Promise<bigint> {
  let pendingSnapshot = Promise.resolve();
  return (actor) => {
    const known = store.get("ActionNonce", { game_id: gameId, actor: BigInt(actor) });
    if (known) return known.next_nonce;
    const nonce = pendingSnapshot.then(async () => {
      if (!store.get("ActionNonce", { game_id: gameId, actor: BigInt(actor) })) await prepareNonce?.(actor);
      // Capture the intent's nonce before another actor can replace this snapshot.
      return nextNonce(store, gameId, actor);
    });
    // A failed snapshot rejects its caller without blocking other players.
    pendingSnapshot = nonce.then(
      () => {},
      () => {},
    );
    return nonce;
  };
}
