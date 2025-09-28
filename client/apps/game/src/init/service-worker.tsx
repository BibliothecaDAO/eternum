import React from "react";
import ReactDOM from "react-dom/client";

import { PWAUpdatePopup } from "@/ui/shared";
import { registerSW } from "virtual:pwa-register";

export const initializeServiceWorkerUpdates = () => {
  const existingContainer = document.getElementById("pwa-update-container");
  const updateContainer = existingContainer ?? document.createElement("div");

  if (!existingContainer) {
    updateContainer.id = "pwa-update-container";
    document.body.appendChild(updateContainer);
  }

  const updateRoot = ReactDOM.createRoot(updateContainer as HTMLElement);

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

  return updateSW;
};
