import { getActiveWorld } from "@/runtime/world";
import { env } from "../../env";

const DEFAULT_TORII_URL = env.VITE_PUBLIC_TORII ?? "http://localhost:8080";

export const getToriiBaseUrl = (): string => {
  const active = getActiveWorld();
  return active?.toriiBaseUrl ?? DEFAULT_TORII_URL;
};
