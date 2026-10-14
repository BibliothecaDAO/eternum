import type GUI from "lil-gui";
import { DEV_MODE_ENABLED } from "@/utils/dev-mode";
import type { GraphicsGuiRuntime } from "./graphics-gui";

export const GRAPHICS_DEV_GUI_ENABLED = DEV_MODE_ENABLED;

let activeRuntime: GraphicsGuiRuntime | undefined;

export function createGraphicsGuiLifetime() {
  let disposed = false;
  let runtime: GraphicsGuiRuntime | undefined;
  const ready = GRAPHICS_DEV_GUI_ENABLED
    ? import("./graphics-gui").then(({ createGraphicsGuiRuntime }) => {
        if (disposed) return;
        runtime = createGraphicsGuiRuntime();
        activeRuntime = runtime;
      })
    : Promise.resolve();

  return {
    ready,
    dispose() {
      disposed = true;
      if (activeRuntime === runtime) activeRuntime = undefined;
      runtime?.dispose();
      runtime = undefined;
    },
  };
}

export function createGuiFolder(name: string): GUI {
  if (!activeRuntime) throw new Error("Initialize the graphics GUI before creating debug controls");
  return activeRuntime.createFolder(name);
}
