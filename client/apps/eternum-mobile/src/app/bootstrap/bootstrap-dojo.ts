import { setSqlApiBaseUrl } from "@/app/services/api";
import { getActiveWorld, patchManifestWithFactory } from "@/shared/lib/world";
import type { SetupResult } from "@bibliothecadao/dojo";
import { runDojoSetup } from "@bibliothecadao/react";
import { Chain, getGameManifest } from "@contracts";
import { dojoConfig } from "../../../dojoConfig";
import { env } from "../../../env";
import { ETERNUM_CONFIG } from "../config/config";
import { initialSync } from "../dojo/sync";

export type BootstrapResult = SetupResult;

export const bootstrapDojo = async (chain: Chain, onProgress: (progress: number) => void) => {
  const activeWorld = getActiveWorld();

  if (activeWorld) {
    const baseManifest = getGameManifest(chain);
    const patchedManifest = patchManifestWithFactory(
      baseManifest as any,
      activeWorld.worldAddress,
      activeWorld.contractsBySelector,
    );

    (dojoConfig as any).manifest = patchedManifest;
    if (chain === "local") {
      (dojoConfig as any).toriiUrl = env.VITE_PUBLIC_TORII;
      (dojoConfig as any).rpcUrl = env.VITE_PUBLIC_NODE_URL;
    } else {
      (dojoConfig as any).toriiUrl = activeWorld.toriiBaseUrl;
    }

    const toriiBaseUrl = chain === "local" ? env.VITE_PUBLIC_TORII : activeWorld.toriiBaseUrl;
    setSqlApiBaseUrl(`${toriiBaseUrl}/sql`);
  } else {
    setSqlApiBaseUrl(`${env.VITE_PUBLIC_TORII}/sql`);
  }

  const setupResult = await runDojoSetup({
    dojoConfig,
    setupOptions: {
      vrfProviderAddress: env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
      useBurner: env.VITE_PUBLIC_CHAIN === "local",
    },
    callbacks: {
      onNoAccount: () => {
        console.log("No account");
      },
      onError: (error) => {
        console.error("System call error:", error);
      },
    },
    initialSync: (result) => initialSync(result, (progress) => onProgress(progress)),
    eternumConfig: ETERNUM_CONFIG(),
  });

  return setupResult;
};
