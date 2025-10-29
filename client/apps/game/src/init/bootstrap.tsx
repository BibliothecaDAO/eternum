import { captureSystemError } from "@/posthog";
import { setup } from "@bibliothecadao/dojo";
import { configManager } from "@bibliothecadao/eternum";
import { inject } from "@vercel/analytics";
import { ReactNode } from "react";

import { dojoConfig } from "../../dojo-config";
import { env } from "../../env";
import { initialSync } from "../dojo/sync";
import { useSyncStore } from "../hooks/store/use-sync-store";
import { useUIStore } from "../hooks/store/use-ui-store";
import { NoAccountModal } from "../ui/layouts/no-account-modal";
import { ETERNUM_CONFIG } from "../utils/config";
import { initializeGameRenderer } from "./game-renderer";
import { Chain, getGameManifest } from "@contracts";
import { getActiveWorld, patchManifestWithFactory } from "@/runtime/world";
import { setSqlApiBaseUrl } from "@/services/api";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

type BootstrapResult = SetupResult;

let bootstrapPromise: Promise<BootstrapResult> | null = null;

const handleNoAccount = (modalContent: ReactNode) => {
  const uiStore = useUIStore.getState();
  uiStore.setModal(null, false);
  uiStore.setModal(modalContent, true);
};

const runBootstrap = async (): Promise<BootstrapResult> => {
  const uiStore = useUIStore.getState();
  const syncingStore = useSyncStore.getState();

  console.log("[STARTING DOJO SETUP]");

  // 0) World profile is expected to be selected before bootstrap begins (gated in play flow)
  const chain = env.VITE_PUBLIC_CHAIN! as Chain;
  const profile = getActiveWorld();
  if (!profile) {
    throw new Error("No active world selected");
  }

  // 1) Patch manifest with factory-provided addresses and world address
  const baseManifest = getGameManifest(chain);
  const patchedManifest = patchManifestWithFactory(
    baseManifest as any,
    profile.worldAddress,
    profile.contractsBySelector,
  );

  // 2) Update global dojoConfig in place (shared object reference)
  //    - Torii base URL and manifest are used by setup() downstream
  (dojoConfig as any).toriiUrl = profile.toriiBaseUrl;
  (dojoConfig as any).manifest = patchedManifest;

  // 3) Point SQL API to the active world's Torii
  setSqlApiBaseUrl(`${profile.toriiBaseUrl}/sql`);

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

  console.log("[GAME RENDERER INITIALIZED]");

  initializeGameRenderer(setupResult, env.VITE_PUBLIC_GRAPHICS_DEV == true);

  console.log("[GAME RENDERER INITIALIZED]");

  inject();

  return setupResult;
};

export const bootstrapGame = async (): Promise<BootstrapResult> => {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap();
  }

  try {
    return await bootstrapPromise;
  } catch (error) {
    bootstrapPromise = null;
    captureSystemError(error, {
      error_type: "dojo_setup",
      setup_phase: "bootstrap",
      context: "Unhandled error during Dojo bootstrap",
    });
    throw error;
  }
};
