import { captureSystemError } from "@/posthog";
import type { SetupResult as DojoSetupResult } from "@bibliothecadao/dojo";
import { runDojoSetup } from "@bibliothecadao/react";
import { inject } from "@vercel/analytics";
import { ReactNode } from "react";

import { ensureActiveWorldProfileWithUI, getActiveWorld, patchManifestWithFactory } from "@/runtime/world";
import { buildWorldProfile } from "@/runtime/world/profile-builder";
import { setSqlApiBaseUrl } from "@/services/api";
import { Chain, getGameManifest } from "@contracts";
import { dojoConfig } from "../../dojo-config";
import { env } from "../../env";
import { initialSync } from "../dojo/sync";
import { useSyncStore } from "../hooks/store/use-sync-store";
import { useUIStore } from "../hooks/store/use-ui-store";
import { NoAccountModal } from "../ui/layouts/no-account-modal";
import { ETERNUM_CONFIG } from "../utils/config";
import { initializeGameRenderer } from "./game-renderer";

export type SetupResult = DojoSetupResult;

type BootstrapResult = SetupResult;

let bootstrapPromise: Promise<BootstrapResult> | null = null;
let bootstrappedWorldName: string | null = null;

const deriveWorldFromPath = (): string | null => {
  try {
    const match = window.location.pathname.match(/^\/play\/([^/]+)(?:\/|$)/);
    if (!match || !match[1]) return null;
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};

const handleNoAccount = (modalContent: ReactNode) => {
  const uiStore = useUIStore.getState();
  uiStore.setModal(null, false);
  uiStore.setModal(modalContent, true);
};

const runBootstrap = async (): Promise<BootstrapResult> => {
  const uiStore = useUIStore.getState();
  const syncingStore = useSyncStore.getState();

  console.log("[STARTING DOJO SETUP]");

  // 0) Resolve world profile: prefer URL, then active selection, then prompt
  const chain = env.VITE_PUBLIC_CHAIN! as Chain;
  const pathWorld = deriveWorldFromPath();

  let profile = null;
  if (pathWorld) {
    try {
      profile = await buildWorldProfile(chain, pathWorld);
    } catch (err) {
      console.error("[bootstrap] Failed to apply world from URL", err);
    }
  }

  if (!profile) profile = getActiveWorld();
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
  }
  (dojoConfig as any).manifest = patchedManifest;

  // 3) Point SQL API to the active world's Torii
  const toriiUrl = chain === "local" ? env.VITE_PUBLIC_TORII : profile.toriiBaseUrl;
  setSqlApiBaseUrl(`${toriiUrl}/sql`);

  const setupResult = await runDojoSetup({
    dojoConfig,
    setupOptions: {
      vrfProviderAddress: env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
      useBurner: false,
    },
    callbacks: {
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
    initialSync: (result) => initialSync(result, uiStore, syncingStore.setInitialSyncProgress),
    eternumConfig: ETERNUM_CONFIG(),
  });
  console.log("[DOJO SETUP COMPLETED]");

  console.log("[INITIAL SYNC COMPLETED]");

  console.log("[GAME RENDERER INITIALIZED]");

  initializeGameRenderer(setupResult, env.VITE_PUBLIC_GRAPHICS_DEV == true);

  console.log("[GAME RENDERER INITIALIZED]");

  inject();

  return setupResult;
};

export const bootstrapGame = async (): Promise<BootstrapResult> => {
  // Check if we need to re-bootstrap for a different world
  const currentWorld = getActiveWorld();
  const currentWorldName = currentWorld?.name ?? null;

  if (bootstrapPromise && bootstrappedWorldName !== currentWorldName) {
    // World changed, need to re-bootstrap
    // Note: This requires a page reload for proper cleanup of the old Dojo context
    console.log(`[BOOTSTRAP] World changed from "${bootstrappedWorldName}" to "${currentWorldName}", reloading...`);
    window.location.reload();
    // Return a never-resolving promise to prevent further execution
    return new Promise(() => {});
  }

  if (!bootstrapPromise) {
    bootstrappedWorldName = currentWorldName;
    bootstrapPromise = runBootstrap();
  }

  try {
    return await bootstrapPromise;
  } catch (error) {
    bootstrapPromise = null;
    bootstrappedWorldName = null;
    captureSystemError(error, {
      error_type: "dojo_setup",
      setup_phase: "bootstrap",
      context: "Unhandled error during Dojo bootstrap",
    });
    throw error;
  }
};
