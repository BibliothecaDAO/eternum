/// <reference types="vite-plugin-pwa/client" />

import { configManager, setup } from "@bibliothecadao/eternum";
import { inject } from "@vercel/analytics";
import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom/client";
import { ShepherdJourneyProvider } from "react-shepherd";
import "shepherd.js/dist/css/shepherd.css";
import { registerSW } from "virtual:pwa-register";
import { dojoConfig } from "../dojoConfig";
import { env } from "../env";
import App from "./app";
import { initialSync } from "./dojo/sync";
import { DojoProvider } from "./hooks/context/dojo-context";
import { StarknetProvider } from "./hooks/context/starknet-provider";
import { useUIStore } from "./hooks/store/use-ui-store";
import "./index.css";
import GameRenderer from "./three/game-renderer";
import { PWAUpdatePopup } from "./ui/components/pwa-update-popup";
import { IS_MOBILE } from "./ui/config";
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
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("React root not found");
  const root = ReactDOM.createRoot(rootElement as HTMLElement);

  // Redirect mobile users to the mobile version
  if (IS_MOBILE) {
    root.render(
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-brown p-4 text-center text-gold">
        <h1 className="text-2xl font-bold mb-4">Mobile Version Not Available</h1>
        <p className="mb-6">This version of Eternum is not optimized for mobile devices.</p>
        <p className="mb-6">Please visit our mobile-friendly version at:</p>
        <a
          href={env.VITE_PUBLIC_MOBILE_VERSION_URL}
          className="text-xl underline font-bold text-gold hover:text-gold/80"
        >
          next-eternum-mobile.realms.world
        </a>
      </div>,
    );
    return;
  }

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
    root.render(<LoadingScreen backgroundImage={backgroundImage} />);
    return;
  }

  root.render(<LoadingScreen backgroundImage={backgroundImage} />);

  const state = useUIStore.getState();

  console.log("starting setupResult");
  const setupResult = await setup(
    { ...dojoConfig },
    {
      vrfProviderAddress: env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
      useBurner: env.VITE_PUBLIC_CHAIN === "local",
    },
    {
      onNoAccount: () => {
        state.setModal(null, false);
        state.setModal(<NoAccountModal />, true);
      },
      onError: (error) => {
        console.error("System call error:", error);
        // Handle other types of errors if needed
      },
    },
  );

  await initialSync(setupResult, state);

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
      <ShepherdJourneyProvider>
        <StarknetProvider>
          <DojoProvider value={setupResult} backgroundImage={backgroundImage}>
            <App backgroundImage={backgroundImage} />
          </DojoProvider>
        </StarknetProvider>
      </ShepherdJourneyProvider>
    </React.StrictMode>,
  );
}

init();
