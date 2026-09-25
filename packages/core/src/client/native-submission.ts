import { hash, type AccountInterface } from "starknet";
import type { NativeWorldBindings } from "@bibliothecadao/types";
import { frameNativeIntent, StaleGameReleaseError, type NativeSubmission } from "@bibliothecadao/provider";
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
  input: NativeClientConnection & {
    release: { ready(): Promise<void>; refresh(previousRelease: number): Promise<void> };
  },
  store: NativeFactStore,
  gameId: number,
  season: string,
  prepareNonce?: (actor: string) => Promise<void>,
): NativeSubmission {
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
    const submit = async (canRefresh: boolean): Promise<Awaited<ReturnType<NativeSubmission>>> => {
      const nonce = await readNonce(actor.address);
      await input.release.ready();
      const release = store.require("GameRelease", { game_id: gameId });
      const encoded = frameNativeIntent({
        chain: input.chainId,
        deployment: season,
        gameId,
        actor: actor.address,
        nonce,
        releaseId: release.release_id,
        presetCommitment: release.preset_commitment,
        validFrom: 0,
        validUntil: Math.floor(Date.now() / 1_000) + 300,
        lastOrder: 0xffffffffffffffffn,
        arguments: arguments_,
      });
      const signature = await input.signIntent(actor, hash.computePoseidonHashOnElements(encoded));
      try {
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
      } catch (error) {
        if (!canRefresh || !(error instanceof StaleGameReleaseError)) throw error;
        await input.release.refresh(release.release_id);
        return submit(false);
      }
    };
    return submit(true);
  };
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
      const key = { game_id: gameId, actor: BigInt(actor) };
      const current = store.get("ActionNonce", key);
      if (current) return current.next_nonce;
      if (!prepareNonce) throw new Error("Gameplay actor snapshot is not synchronized");
      await prepareNonce(actor);
      // Capture the intent's nonce before another actor can replace this snapshot.
      const nonce = store.requireOrAbsent("ActionNonce", key);
      if (!nonce.known) throw new Error(`ACTION_NONCE_UNKNOWN: ${nonce.unknown}`);
      return nonce.known.next_nonce;
    });
    // A failed snapshot rejects its caller without blocking other players.
    pendingSnapshot = nonce.then(
      () => {},
      () => {},
    );
    return nonce;
  };
}
