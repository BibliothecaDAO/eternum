import { captureSystemError } from "@/posthog";
import { setup } from "@bibliothecadao/dojo";
import { configManager } from "@bibliothecadao/eternum";
import { inject } from "@vercel/analytics";
import { ReactNode } from "react";

import {
  ensureActiveWorldProfileWithUI,
  getActiveWorld,
  isRpcUrlCompatibleForChain,
  normalizeRpcUrl,
  patchManifestWithFactory,
  resolveChain,
} from "@/runtime/world";
import { buildWorldProfile } from "@/runtime/world/profile-builder";
import { setSqlApiBaseUrl } from "@/services/api";
import { Chain, getGameManifest } from "@contracts";
import { dojoConfig } from "../../dojo-config";
import { env, hasPublicNodeUrl } from "../../env";
import { initialSync } from "../dojo/sync";
import { useSyncStore } from "../hooks/store/use-sync-store";
import { useUIStore } from "../hooks/store/use-ui-store";
import { NoAccountModal } from "../ui/layouts/no-account-modal";
import { ETERNUM_CONFIG } from "../utils/config";
import { initializeGameRenderer } from "./game-renderer";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

type BootstrapResult = SetupResult;

let bootstrapPromise: Promise<BootstrapResult> | null = null;
let bootstrappedWorldName: string | null = null;
let bootstrappedChain: string | null = null;
let cachedSetupResult: BootstrapResult | null = null;

/**
 * Get the cached setup result if bootstrap has already completed.
 * Returns null if bootstrap hasn't run or is still in progress.
 */
export const getCachedSetupResult = (): BootstrapResult | null => {
  return cachedSetupResult;
};

const deriveWorldFromPath = (): string | null => {
  try {
    const match = window.location.pathname.match(/^\/play\/([^/]+)(?:\/|$)/);
    if (!match || !match[1]) return null;
    const candidate = decodeURIComponent(match[1]);
    // "map" and "hex" are view modes, not world names
    if (candidate === "map" || candidate === "hex") return null;
    return candidate;
  } catch {
    return null;
  }
};

const isSpectateMode = (): boolean => {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("spectate") === "true";
};

const handleNoAccount = (modalContent: ReactNode) => {
  // Don't show account required modal in spectate mode
  if (isSpectateMode()) {
    console.log("[bootstrap] Skipping account modal - spectate mode");
    return;
  }
  const uiStore = useUIStore.getState();
  uiStore.setModal(null, false);
  uiStore.setModal(modalContent, true);
};

const runBootstrap = async (): Promise<BootstrapResult> => {
  const uiStore = useUIStore.getState();
  const syncingStore = useSyncStore.getState();

  console.log("[STARTING DOJO SETUP]");

  // 0) Resolve world profile: prefer URL, then active selection, then prompt
  const chain = resolveChain(env.VITE_PUBLIC_CHAIN! as Chain);
  const pathWorld = deriveWorldFromPath();

  let profile: any = null;
  if (pathWorld) {
    try {
      profile = await buildWorldProfile(chain, pathWorld);
    } catch (err) {
      console.error("[bootstrap] Failed to apply world from URL", err);
    }
  }

  if (!profile) profile = getActiveWorld();
  let shouldReloadAfterProfileRefresh = false;
  if (profile) {
    const previousRpcUrl = profile.rpcUrl;
    const previousChain = profile.chain;
    const shouldRefreshProfile = () => {
      if (profile.chain && profile.chain !== chain) return true;
      if (!profile.rpcUrl) return true;
      const canUseEnvRpc = hasPublicNodeUrl && isRpcUrlCompatibleForChain(chain, env.VITE_PUBLIC_NODE_URL);
      if (canUseEnvRpc) {
        if (!profile.rpcUrl) return true;
        const normalizedProfileRpc = normalizeRpcUrl(profile.rpcUrl);
        const normalizedEnvRpc = normalizeRpcUrl(env.VITE_PUBLIC_NODE_URL);
        if (normalizedProfileRpc !== normalizedEnvRpc && normalizedProfileRpc.includes(`/x/${profile.name}/katana`)) {
          return true;
        }
        return false;
      }
      if (chain === "slot" || chain === "slottest") {
        return !profile.rpcUrl.includes(`/x/${profile.name}/katana`);
      }
      if (chain === "mainnet" || chain === "sepolia") {
        return profile.rpcUrl.includes("/katana") || !profile.rpcUrl.includes(`/x/starknet/${chain}`);
      }
      return false;
    };

    if (shouldRefreshProfile()) {
      try {
        profile = await buildWorldProfile(chain, profile.name);
        shouldReloadAfterProfileRefresh =
          !profile ||
          !previousRpcUrl ||
          profile.rpcUrl !== previousRpcUrl ||
          (previousChain && profile.chain !== previousChain);
      } catch (err) {
        console.error("[bootstrap] Failed to refresh world profile rpcUrl", err);
      }
    }
  }
  if (shouldReloadAfterProfileRefresh) {
    console.log("[bootstrap] World profile refreshed, reloading to apply RPC changes");
    window.location.reload();
    return new Promise(() => {});
  }
  if (!profile) profile = await ensureActiveWorldProfileWithUI(chain);

  // 1) Patch manifest with factory-provided addresses and world address
  const baseManifest = getGameManifest(chain);
  const patchedManifest = patchManifestWithFactory(
    baseManifest as any,
    profile.worldAddress,
    profile.contractsBySelector,
  );

  // 2) Update global dojoConfig in place (shared object reference)
  //    - Torii base URL and manifest are used by setup() downstream
  //    - For local chain, use environment variables directly
  if (chain === "local") {
    (dojoConfig as any).toriiUrl = env.VITE_PUBLIC_TORII;
    (dojoConfig as any).rpcUrl = env.VITE_PUBLIC_NODE_URL;
  } else {
    (dojoConfig as any).toriiUrl = profile.toriiBaseUrl;
    (dojoConfig as any).rpcUrl = profile.rpcUrl ?? env.VITE_PUBLIC_NODE_URL;
  }
  (dojoConfig as any).manifest = patchedManifest;

  // 3) Point SQL API to the active world's Torii
  const toriiUrl = chain === "local" ? env.VITE_PUBLIC_TORII : profile.toriiBaseUrl;
  setSqlApiBaseUrl(`${toriiUrl}/sql`);

  const setupResult = await setup(
    { ...dojoConfig },
    {
      vrfProviderAddress: env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
      useBurner: false,
    },
    {
      onNoAccount: () => {
        handleNoAccount(<NoAccountModal />);
      },
      onError: (error: unknown) => {
        console.error("System call error:", error);

        captureSystemError(error, {
          error_type: "dojo_system_call",
          setup_phase: "post-setup",
          context: "System call error during post-setup phase",
        });
      },
    },
  );
  console.log("[DOJO SETUP COMPLETED]");

  await initialSync(setupResult, uiStore, syncingStore.setInitialSyncProgress);

  console.log("[INITIAL SYNC COMPLETED]");

  configManager.setDojo(setupResult.components, ETERNUM_CONFIG());

  initializeGameRenderer(setupResult, env.VITE_PUBLIC_GRAPHICS_DEV == true);

  inject();

  return setupResult;
};

/**
 * Reset the bootstrap state to allow re-bootstrapping without a page reload.
 * Used when switching between worlds on the same chain.
 */
export const resetBootstrap = () => {
  console.log("[BOOTSTRAP] Resetting bootstrap state");
  bootstrapPromise = null;
  bootstrappedWorldName = null;
  bootstrappedChain = null;
  cachedSetupResult = null;
};

export const bootstrapGame = async (): Promise<BootstrapResult> => {
  // Check if we need to re-bootstrap for a different world
  const currentWorld = getActiveWorld();
  const currentWorldName = currentWorld?.name ?? null;
  const currentChain = currentWorld?.chain ?? null;

  // If chain changed, we MUST reload the page for proper cleanup
  if (bootstrapPromise && bootstrappedChain && currentChain && bootstrappedChain !== currentChain) {
    console.log(`[BOOTSTRAP] Chain changed from "${bootstrappedChain}" to "${currentChain}", reloading page...`);
    window.location.reload();
    return new Promise(() => {}); // Never resolves
  }

  // If only world changed (same chain), reset and re-bootstrap without reload
  if (bootstrapPromise && bootstrappedWorldName !== currentWorldName) {
    console.log(
      `[BOOTSTRAP] World changed from "${bootstrappedWorldName}" to "${currentWorldName}", re-bootstrapping...`,
    );
    resetBootstrap();
  }

  if (!bootstrapPromise) {
    bootstrappedWorldName = currentWorldName;
    bootstrappedChain = currentChain;
    bootstrapPromise = runBootstrap().then((result) => {
      cachedSetupResult = result;
      return result;
    });
  }

  try {
    return await bootstrapPromise;
  } catch (error) {
    bootstrapPromise = null;
    bootstrappedWorldName = null;
    bootstrappedChain = null;
    cachedSetupResult = null;
    captureSystemError(error, {
      error_type: "dojo_setup",
      setup_phase: "bootstrap",
      context: "Unhandled error during Dojo bootstrap",
    });
    throw error;
  }
};
