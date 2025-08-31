import GUI from "lil-gui";
import { env } from "../../../../../env";

export const GUIManager = new GUI({
  autoPlace: env.VITE_PUBLIC_GRAPHICS_DEV == true,
});

GUIManager.close();
