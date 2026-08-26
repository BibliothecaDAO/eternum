import type { GameChain as Chain } from "@realms-world/chain";
import { resolveEndpoint } from "@realms-world/chain";
import { env } from "../../env";

export const getRpcUrlForChain = (_chain: Chain | string): string =>
  resolveEndpoint(env.VITE_PUBLIC_NODE_URL, { name: "VITE_PUBLIC_NODE_URL", browserFacing: true });
