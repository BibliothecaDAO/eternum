import { useAccountStore } from "@/hooks/store/use-account-store";
import { getNativeManifest, nativeBindings } from "@/runtime/world/native-manifest";
import { createBrowserScheduler } from "@/sync/browser-scheduler";
import { getCachedRpcProvider } from "@/utils/cached-rpc-provider";
import {
  createGameClient,
  createNativeTicketSubmission,
  getStoredGameplayKey,
  resolveGameTransactionResourceBounds,
} from "@bibliothecadao/eternum";
import { ec } from "starknet";

type BrowserGameInput = Pick<
  Parameters<typeof createGameClient>[0],
  "world" | "gameId" | "presetId" | "observer" | "authHandler"
>;

/** Renderer boot and settlement use the same deployment, signing key and Herald store. */
export async function createBrowserGameClient(input: BrowserGameInput) {
  const chainId = await getCachedRpcProvider(input.world.rpcUrl).getChainId();
  return createGameClient({
    ...input,
    networkConfig: { manifest: getNativeManifest(), rpcUrl: input.world.rpcUrl },
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
      submitIntent: createNativeTicketSubmission(input.world.admissionUrl),
    },
    setupEnvironment: { executionResourceBounds: resolveGameTransactionResourceBounds(input.world.chain) },
    scheduler: createBrowserScheduler(),
  });
}
