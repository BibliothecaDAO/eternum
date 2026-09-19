import { getNativeManifest } from "@/runtime/world/native-manifest";
import type { GameChain as Chain } from "@realms-world/chain";

import {
  buildWorldDeployment,
  installWorldDirectory,
  type CommittedManifest,
  type WorldDeployment,
} from "@bibliothecadao/eternum/game-client";
import { env } from "../../../env";

/**
 * The web client's worlds: committed manifests plus the deployment's env,
 * registered with the shared directory so every consumer reads through
 * `getWorldDirectory` / `getWorldById` / `getDefaultWorld`.
 */
const buildAppWorld = (chain: Chain, id: "blitz" | "eternum"): WorldDeployment =>
  buildWorldDeployment({
    id,
    chain,
    manifest: getNativeManifest() as unknown as CommittedManifest,
    heraldBaseUrl: env.VITE_PUBLIC_HERALD_URL,
    admissionUrl: env.VITE_PUBLIC_ADMISSION_URL,
    rpcUrl: env.VITE_PUBLIC_NODE_URL,
    browserFacing: true,
    playerAccountClassHash: env.VITE_PUBLIC_PLAYER_ACCOUNT_CLASS_HASH,
    playerRegistryAddress: env.VITE_PUBLIC_PLAYER_REGISTRY_ADDRESS,
    bindingAuthorityAddress: env.VITE_PUBLIC_BINDING_AUTHORITY_ADDRESS,
  });

installWorldDirectory(() => [buildAppWorld(env.VITE_PUBLIC_CHAIN, "blitz")]);

export {
  getDefaultWorld,
  getWorldById,
  requireWorldById,
  getWorldDirectory,
  type WorldDeployment,
} from "@bibliothecadao/eternum/game-client";
