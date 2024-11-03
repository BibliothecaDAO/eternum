import { IS_MOBILE } from "@/ui/config";
import GUI from "lil-gui";

export const GUIManager = new GUI({
  autoPlace: import.meta.env.VITE_PUBLIC_DEV == "true" && !IS_MOBILE,
});

GUIManager.close();
