import { useAccountStore } from "@/hooks/store/use-account-store";
import { createBrowserScheduler } from "@/sync/browser-scheduler";
import { createGameClient, createNativeTicketSubmission, getStoredGameplayKey } from "@bibliothecadao/eternum";
import { ec } from "starknet";

type BrowserGameInput = Pick<
  Parameters<typeof createGameClient>[0],
  "shard" | "gameId" | "presetId" | "observer" | "authHandler"
>;

/** Renderer boot and settlement use the same deployment, signing key and Herald store. */
export async function createBrowserGameClient(input: BrowserGameInput) {
  const chainId = input.shard.chainId;
  // The compiled bindings load when a game is entered, never with the landing.
  const { nativeBindings } = await import("@/runtime/world/native-bindings");
  return createGameClient({
    ...input,
    native: {
      bindings: nativeBindings,
      chainId,
      signIntent: async (actor, digest) => {
        const { account, owner } = useAccountStore.getState();
        if (!account || !owner || BigInt(account.address) !== BigInt(actor.address))
          throw new Error("Gameplay identity changed before signing");
        const key = getStoredGameplayKey({ storage: localStorage, chainId, owner });
        if (!key) throw new Error("Gameplay signing key is unavailable");
        const signature = ec.starkCurve.sign(digest, key.privateKey);
        return { r: signature.r, s: signature.s, publicKey: BigInt(key.publicKey) };
      },
      submitIntent: createNativeTicketSubmission(input.shard.admissionUrl),
    },
    scheduler: createBrowserScheduler(),
  });
}
