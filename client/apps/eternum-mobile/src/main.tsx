/// <reference types="vite-plugin-pwa/client" />
import App from "@/app/app.tsx";
import { DojoProvider } from "@/app/dojo/context/dojo-context";
import { StarknetProvider } from "@/app/dojo/context/starknet-provider";
import "@/app/index.css";
import { ThemeProvider } from "@/app/providers/theme-provider";
import { configManager, setup } from "@bibliothecadao/eternum";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { dojoConfig } from "../dojoConfig";
import { env } from "../env";
import { ETERNUM_CONFIG } from "./app/config/config";
import { initialSync } from "./app/dojo/sync";
import { useStore } from "./shared/store";
import { WorldSlice } from "./shared/store/slices/world-loading-slice";

// Register service worker with debug logs
registerSW({
  onNeedRefresh() {
    console.log("[PWA] New content available, click on reload button to update.");
    // Here you can show a UI notification to the user
  },
  onOfflineReady() {
    console.log("[PWA] App ready to work offline");
    // Here you can show a UI notification to the user
  },
  onRegistered(registration) {
    console.log("[PWA] Service worker registered:", registration);

    if (registration) {
      // Check if push manager is available
      console.log("[PWA] PushManager available:", "pushManager" in registration);

      // Log subscription state
      registration.pushManager.getSubscription().then((subscription) => {
        console.log("[PWA] Current push subscription:", subscription);
      });

      // Check permission state
      console.log("[PWA] Notification permission:", Notification.permission);
    }
  },
  onRegisterError(error) {
    console.error("[PWA] Service worker registration error:", error);
  },
});

// Ensure the service worker is registered before initializing the app
navigator.serviceWorker.ready
  .then((registration) => {
    console.log("[PWA] Service worker is ready:", registration);
    main();
  })
  .catch((error) => {
    console.error("[PWA] Error waiting for service worker:", error);
    // Still run the app even if service worker failed
    main();
  });

async function main() {
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

  const state: WorldSlice = useStore.getState();
  await initialSync(setupResult, state);

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
