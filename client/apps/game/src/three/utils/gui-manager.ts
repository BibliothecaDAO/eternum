import GUI from "lil-gui";
import { DEV_MODE_ENABLED } from "@/utils/dev-mode";

export const GRAPHICS_DEV_GUI_ENABLED = DEV_MODE_ENABLED;

type NoopGuiController = {
  listen(): NoopGuiController;
  name(_label?: string): NoopGuiController;
  onChange(_handler?: unknown): NoopGuiController;
  onFinishChange(_handler?: unknown): NoopGuiController;
  step(_value?: unknown): NoopGuiController;
  updateDisplay(): NoopGuiController;
};

function createNoopGuiController(): NoopGuiController {
  const controller: NoopGuiController = {
    listen: () => controller,
    name: () => controller,
    onChange: () => controller,
    onFinishChange: () => controller,
    step: () => controller,
    updateDisplay: () => controller,
  };

  return controller;
}

function createNoopGui(): GUI {
  const controller = createNoopGuiController();
  const noop = () => undefined;
  const gui = {
    add: () => controller,
    addColor: () => controller,
    addFolder: () => gui,
    close: noop,
    controllersRecursive: () => [],
    destroy: noop,
    foldersRecursive: () => [],
    open: noop,
  };

  return gui as unknown as GUI;
}

const GUIManager = GRAPHICS_DEV_GUI_ENABLED
  ? new GUI({
      autoPlace: true,
    })
  : createNoopGui();

if (GRAPHICS_DEV_GUI_ENABLED) {
  GUIManager.close();
}

export function createGuiFolder(name: string): GUI {
  if (!GUIManager || typeof GUIManager.addFolder !== "function") {
    return createNoopGui();
  }

  try {
    const folder = GUIManager.addFolder(name);
    if (!folder || typeof folder.addFolder !== "function") {
      return createNoopGui();
    }

    return folder;
  } catch {
    return createNoopGui();
  }
}
