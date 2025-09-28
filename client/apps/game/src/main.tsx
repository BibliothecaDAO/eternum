/// <reference types="vite-plugin-pwa/client" />

import { captureSystemError, initPostHog } from "@/posthog";
import { cleanupTracing } from "@/tracing";
import { setup } from "@bibliothecadao/dojo";
import { configManager } from "@bibliothecadao/eternum";
import { inject } from "@vercel/analytics";
import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom/client";

import { dojoConfig } from "../dojo-config";
import { env } from "../env";
import App from "./app";
import { initialSync } from "./dojo/sync";
import { DojoProvider } from "./hooks/context/dojo-context";
import { MetagameProvider } from "./hooks/context/metagame-provider";
import { StarknetProvider } from "./hooks/context/starknet-provider";
import { useSyncStore } from "./hooks/store/use-sync-store";
import { useUIStore } from "./hooks/store/use-ui-store";
import "./index.css";
import { initializeGameRenderer } from "./init/game-renderer";
import { initializeServiceWorkerUpdates } from "./init/service-worker";
import { IS_MOBILE } from "./ui/config";
import { NoAccountModal } from "./ui/layouts/no-account-modal";
import { ConstructionGate } from "./ui/modules/construction-gate";
import { LoadingScreen } from "./ui/modules/loading-screen";
import { MobileBlocker } from "./ui/modules/mobile-blocker";
import { getRandomBackgroundImage } from "./ui/utils/utils";
import { ETERNUM_CONFIG } from "./utils/config";

declare global {
  interface Window {
    Buffer: typeof Buffer;
  }
}

window.Buffer = Buffer;

async function init() {
  // Initialize PostHog for analytics and error reporting
  initPostHog();

  // // Initialize tracing system
  // initializeTracing({
  //   enableMetricsCollection: true,
  //   metricsInterval: 1000,
  // });

  // Set up cleanup on page unload
  window.addEventListener("beforeunload", () => {
    cleanupTracing();
  });

  // // Load test utilities in development
  // if (import.meta.env.DEV) {
  //   import("./tracing/test-tracing").then(() => {
  //     console.log("🧪 Tracing test utilities loaded. Use TestTracing.runAllTests() to test.");
  //   });
  // }

  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("React root not found");
  const root = ReactDOM.createRoot(rootElement as HTMLElement);

  initializeServiceWorkerUpdates();

  const backgroundImage = getRandomBackgroundImage();

  if (env.VITE_PUBLIC_CONSTRUCTION_FLAG == true) {
    root.render(<ConstructionGate />);
    return;
  }

  if (IS_MOBILE) {
    root.render(<MobileBlocker mobileVersionUrl={env.VITE_PUBLIC_MOBILE_VERSION_URL} />);
    return;
  }

  root.render(<LoadingScreen backgroundImage={backgroundImage} />);

  const state = useUIStore.getState();
  const syncingStore = useSyncStore.getState();

  console.log("[STARTING DOJO SETUP...]");
  const setupResult = await setup(
    { ...dojoConfig },
    {
      vrfProviderAddress: env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
      useBurner: false,
    },
    {
      onNoAccount: () => {
        state.setModal(null, false);
        state.setModal(<NoAccountModal />, true);
      },
      onError: (error: any) => {
        console.error("System call error:", error);

        // Report to PostHog
        captureSystemError(error, {
          error_type: "dojo_system_call",
          setup_phase: "post-setup",
          context: "System call error during post-setup phase",
        });
      },
    },
  );

  await initialSync(setupResult, state, syncingStore.setInitialSyncProgress);

  configManager.setDojo(setupResult.components, ETERNUM_CONFIG());

  initializeGameRenderer(setupResult, env.VITE_PUBLIC_GRAPHICS_DEV == true);

  inject();
  root.render(
    <React.StrictMode>
      <StarknetProvider>
        <DojoProvider value={setupResult} backgroundImage={backgroundImage}>
          <MetagameProvider>
            <App backgroundImage={backgroundImage} />
          </MetagameProvider>
        </DojoProvider>
      </StarknetProvider>
    </React.StrictMode>,
  );
}

init();
