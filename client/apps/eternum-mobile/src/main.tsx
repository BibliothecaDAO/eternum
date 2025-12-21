import App from "@/app/app.tsx";
import { DojoProvider } from "@/app/dojo/context/dojo-context";
import { StarknetProvider } from "@/app/dojo/context/starknet-provider";
import "@/app/index.css";
import { setSqlApiBaseUrl } from "@/app/services/api";
import { ThemeProvider } from "@/app/providers/theme-provider";
import { getActiveWorld, patchManifestWithFactory } from "@/shared/lib/world";
import { setup } from "@bibliothecadao/dojo";
import { configManager } from "@bibliothecadao/eternum";
import { Chain, getGameManifest } from "@contracts";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { dojoConfig } from "../dojoConfig";
import { env } from "../env";
import { ETERNUM_CONFIG } from "./app/config/config";
import { initialSync } from "./app/dojo/sync";

async function main() {
  const chain = env.VITE_PUBLIC_CHAIN as Chain;
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

  const setupResult = await setup(
    { ...dojoConfig },
    {
      vrfProviderAddress: env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
      useBurner: env.VITE_PUBLIC_CHAIN === "local",
    },
    {
      onNoAccount: () => {
        console.log("No account");
      },
      onError: (error) => {
        console.error("System call error:", error);
        // Handle other types of errors if needed
      },
    },
  );

  await initialSync(setupResult, (progress) => {
    console.log("progress", progress);
  });

  const eternumConfig = ETERNUM_CONFIG();
  configManager.setDojo(setupResult.components, eternumConfig);

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider>
        <StarknetProvider>
          <DojoProvider value={setupResult}>
            <App />
          </DojoProvider>
        </StarknetProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

main();
