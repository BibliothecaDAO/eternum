import { useAccountStore } from "@/hooks/store/use-account-store";
import { createBrowserScheduler } from "@/sync/browser-scheduler";
import {
  createGameClient,
  createNativeTicketSubmission,
  getOrCreateDeviceKey,
  signGameplayIntent,
} from "@bibliothecadao/eternum";

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
        const { account } = useAccountStore.getState();
        if (!account || BigInt(account.address) !== BigInt(actor.address))
          throw new Error("Gameplay identity changed before signing");
        return signGameplayIntent(digest, getOrCreateDeviceKey(localStorage).privateKey);
      },
      submitIntent: createNativeTicketSubmission(input.shard.admissionUrl),
    },
    scheduler: createBrowserScheduler(),
  });
}
