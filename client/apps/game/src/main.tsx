/// <reference types="vite-plugin-pwa/client" />

import { ReactComponent as EternumWordsLogo } from "@/assets/icons/realms-words-logo-b.svg";
import { captureSystemError, initPostHog } from "@/posthog";
import { setup } from "@bibliothecadao/dojo";
import { configManager } from "@bibliothecadao/eternum";
import { inject } from "@vercel/analytics";
import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom/client";

import { PWAUpdatePopup } from "@/ui/shared";
import { registerSW } from "virtual:pwa-register";
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
import GameRenderer from "./three/game-renderer";
import { IS_MOBILE } from "./ui/config";
import Button from "./ui/design-system/atoms/button";
import { NoAccountModal } from "./ui/layouts/no-account-modal";
import { LoadingScreen } from "./ui/modules/loading-screen";
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

  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("React root not found");
  const root = ReactDOM.createRoot(rootElement as HTMLElement);

  const updateContainer = document.createElement("div");
  updateContainer.id = "pwa-update-container";
  document.body.appendChild(updateContainer);
  const updateRoot = ReactDOM.createRoot(updateContainer);

  const updateSW = registerSW({
    onNeedRefresh() {
      updateRoot.render(
        <PWAUpdatePopup
          onUpdate={() => {
            updateSW(true);
          }}
        />,
      );
    },
    onOfflineReady() {
      console.log("App ready to work offline");
    },
    immediate: true,
  });

  const backgroundImage = getRandomBackgroundImage();

  if (env.VITE_PUBLIC_CONSTRUCTION_FLAG == true) {
    root.render(
      <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden p-4 text-center text-gold">
        {/* Background video */}
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src="/videos/01.mp4"
          autoPlay
          loop
          muted
          playsInline
        />

        {/* Content */}
        <div className="panel-wood relative z-10 flex w-full max-w-lg flex-col items-center justify-center rounded-xl border p-6 sm:max-w-xl md:max-w-2xl md:p-10 bg-brown">
          <EternumWordsLogo className="mx-auto w-28 fill-current stroke-current sm:w-40 lg:w-48" />

          <p className="my-6 text-lg leading-snug sm:text-xl md:text-2xl">
            Eternum is being crafted, and will be available soon...
          </p>

          <div className="mt-4 flex w-full flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <a
              href="https://discord.gg/uQnjZhZPfu"
              target="_blank"
              rel="noopener noreferrer"
              className="button-wood flex items-center px-4 py-2"
            >
              <svg className="mr-2 h-5 w-5 fill-gold" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Discord
            </a>

            <a
              href="https://twitter.com/RealmsEternum"
              target="_blank"
              rel="noopener noreferrer"
              className="button-wood flex items-center px-4 py-2"
            >
              <svg className="mr-2 h-5 w-5 fill-gold" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
              </svg>
              Twitter
            </a>

            <Button
              variant="gold"
              className="w-full sm:w-auto"
              onClick={() => window.open("https://empire.realms.world/trade", "_blank")}
            >
              Buy a Season Pass
            </Button>

            <Button
              variant="gold"
              className="w-full sm:w-auto"
              onClick={() => window.open("https://docs.eternum.realms.world/", "_blank")}
            >
              Docs
            </Button>
          </div>
        </div>
      </div>,
    );
    return;
  }

  if (IS_MOBILE) {
    root.render(
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-brown p-4 text-center text-gold">
        <h1 className="text-2xl font-bold mb-4">Mobile Version Not Available</h1>
        <p className="mb-6">
          This version of Eternum is not optimized for mobile devices. Please visit the desktop site or our
          mobile-friendly version.
        </p>

        {/* TODO add back in when mobile version is ready */}
        <p className="mb-6">Please visit our mobile-friendly version at:</p>
        <a
          href={env.VITE_PUBLIC_MOBILE_VERSION_URL}
          className="text-xl underline font-bold text-gold hover:text-gold/80"
        >
          Mobile Version
        </a>
      </div>,
    );
    return;
  }

  root.render(<LoadingScreen backgroundImage={backgroundImage} />);

  const state = useUIStore.getState();
  const syncingStore = useSyncStore.getState();

  console.log("starting setupResult");
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

  const eternumConfig = ETERNUM_CONFIG();
  configManager.setDojo(setupResult.components, eternumConfig);

  const graphic = new GameRenderer(setupResult);

  graphic.initScene();
  if (env.VITE_PUBLIC_GRAPHICS_DEV == true) {
    graphic.initStats();
  }

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
