import GUI from "lil-gui";
import { mountCosmeticDebugControls } from "../cosmetics/debug-gui";

export interface GraphicsGuiRuntime {
  createFolder(name: string): GUI;
  dispose(): void;
}

export function createGraphicsGuiRuntime(): GraphicsGuiRuntime {
  const root = new GUI({ autoPlace: true });
  root.close();
  let disposeCosmetics: () => void;
  try {
    disposeCosmetics = mountCosmeticDebugControls(root);
  } catch (error) {
    root.destroy();
    throw error;
  }
  return {
    createFolder: (name) => root.addFolder(name),
    dispose() {
      disposeCosmetics();
      root.destroy();
    },
  };
}
