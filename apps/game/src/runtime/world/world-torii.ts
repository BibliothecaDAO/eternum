import { env } from "../../../env";
import { resolveEndpoint } from "@realms-world/chain";

/** Every game is a GameRegistry row in the configured persistent world. */
export const resolveWorldToriiBaseUrl = (_worldName: string): string =>
  resolveEndpoint(env.VITE_PUBLIC_TORII, {
    name: "VITE_PUBLIC_TORII",
    browserFacing: true,
  });
