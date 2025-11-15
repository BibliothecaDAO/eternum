import { getActiveWorld } from "@/runtime/world";
import { env } from "../../env";

export const getToriiBaseUrl = (): string => {
  const active = getActiveWorld();
  return active?.toriiBaseUrl ?? env.VITE_PUBLIC_TORII;
};
