import GUI from "lil-gui";
import { env } from "../../../env";

export interface GuiControllerLike {
  listen(enabled?: boolean): GuiControllerLike;
  name(label: string): GuiControllerLike;
  onChange(handler: (value: any) => void): GuiControllerLike;
  onFinishChange(handler: (value: any) => void): GuiControllerLike;
  updateDisplay(): GuiControllerLike;
}

export interface GuiFolderLike {
  add(target: object, property: string, ...args: unknown[]): GuiControllerLike;
  addColor(target: object, property: string, rgbScale?: number): GuiControllerLike;
  addFolder(name: string): GuiFolderLike;
  close(): GuiFolderLike;
  controllersRecursive(): GuiControllerLike[];
  destroy(): void;
  open(): GuiFolderLike;
}

function createNoopGuiController(): GuiControllerLike {
  const controller: GuiControllerLike = {
    listen: () => controller,
    name: () => controller,
    onChange: () => controller,
    onFinishChange: () => controller,
    updateDisplay: () => controller,
  };

  return controller;
}

function createNoopGuiManager(): GuiFolderLike {
  const controller = createNoopGuiController();
  const folder: GuiFolderLike = {
    add: () => controller,
    addColor: () => controller,
    addFolder: () => folder,
    close: () => folder,
    controllersRecursive: () => [],
    open: () => folder,
    destroy: () => {},
  };

  return folder;
}

export const GUIManager: GuiFolderLike =
  typeof document === "undefined"
    ? createNoopGuiManager()
    : (new GUI({
        autoPlace: env.VITE_PUBLIC_GRAPHICS_DEV == true,
      }) as GuiFolderLike);

GUIManager.close();
