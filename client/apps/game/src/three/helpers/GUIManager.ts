import { IS_MOBILE } from "@/ui/config";
import GUI from "lil-gui";
import { env } from "../../../env";

export const GUIManager = new GUI({
  autoPlace: env.VITE_PUBLIC_DEV == true && !IS_MOBILE,
});

GUIManager.close();
