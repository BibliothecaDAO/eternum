import ReactDOM from "react-dom/client";

import { PWAUpdatePopup } from "@/ui/shared";
import { registerSW } from "virtual:pwa-register";

const PWA_CONTAINER_ID = "pwa-update-container";

const getOrCreateContainer = () => {
  const existing = document.getElementById(PWA_CONTAINER_ID);
  if (existing) {
    return existing;
  }

  const container = document.createElement("div");
  container.id = PWA_CONTAINER_ID;
  document.body.appendChild(container);
  return container;
};

const renderedRoots = new WeakMap<HTMLElement, ReturnType<typeof ReactDOM.createRoot>>();

const getRoot = (container: HTMLElement) => {
  const existingRoot = renderedRoots.get(container);
  if (existingRoot) {
    return existingRoot;
  }

  const root = ReactDOM.createRoot(container);
  renderedRoots.set(container, root);
  return root;
};

export const initializeServiceWorkerUpdates = () => {
  const container = getOrCreateContainer();
  const updateRoot = getRoot(container);

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
