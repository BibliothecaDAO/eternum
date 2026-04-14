import GUI from "lil-gui";
import { env } from "../../../env";

type GuiFolderLike = {
  add: () => GuiFolderLike;
  addFolder: () => GuiFolderLike;
  close: () => GuiFolderLike;
  open: () => GuiFolderLike;
  destroy: () => void;
};

function createNoopGuiManager(): GuiFolderLike {
  const folder: GuiFolderLike = {
    add: () => folder,
    addFolder: () => folder,
    close: () => folder,
    open: () => folder,
    destroy: () => {},
  };

  return folder;
}

export const GUIManager =
  typeof document === "undefined"
    ? createNoopGuiManager()
    : new GUI({
        autoPlace: env.VITE_PUBLIC_GRAPHICS_DEV == true,
      });

GUIManager.close();
