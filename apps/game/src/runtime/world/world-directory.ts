import { getGameManifest } from "@contracts";
import type { GameChain as Chain } from "@realms-world/chain";
import { resolveEndpoint } from "@realms-world/chain";

import { namespaceForChain, type GameNamespace } from "@/sync/game-scope";
import { env } from "../../../env";
import { normalizeSelector } from "./normalize";

/**
 * The world directory — the client's single source of "what worlds exist".
 *
 * A world is one deployed world contract plus its Herald stream; games (Blitz)
 * and seasons (Eternum) are GameRegistry rows inside a world. Phase two
 * exposes the one persistent Blitz world indexed by Herald.
 *
 * Both phase-one chains use committed manifests and GameRegistry rows.
 */
export interface WorldDeployment {
  /** Stable world key — "blitz" now, "eternum" from W5. */
  id: string;
  chain: Chain;
  rpcUrl: string;
  heraldBaseUrl: string;
  namespace: GameNamespace;
  worldAddress: string;
  /** Normalized selector -> address from the world's committed manifest. */
  contractsBySelector: Record<string, string>;
  playerAccountClassHash: string;
  playerRegistryAddress: string;
  bindingAuthorityAddress: string;
}

interface CommittedManifest {
  world: { address: string };
  contracts: { selector: string; address: string }[];
}

const buildWorld = (chain: Chain, id: "blitz" | "eternum"): WorldDeployment => {
  const manifest = getGameManifest(chain, id) as unknown as CommittedManifest;
  return {
    id,
    chain,
    heraldBaseUrl: resolveEndpoint(env.VITE_PUBLIC_HERALD_URL, {
      name: "VITE_PUBLIC_HERALD_URL",
      browserFacing: true,
    }),
    rpcUrl: resolveEndpoint(env.VITE_PUBLIC_NODE_URL, { name: "VITE_PUBLIC_NODE_URL", browserFacing: true }),
    namespace: namespaceForChain(chain),
    worldAddress: manifest.world.address,
    contractsBySelector: Object.fromEntries(
      manifest.contracts.map((contract) => [normalizeSelector(contract.selector), contract.address]),
    ),
    playerAccountClassHash: env.VITE_PUBLIC_PLAYER_ACCOUNT_CLASS_HASH,
    playerRegistryAddress: env.VITE_PUBLIC_PLAYER_REGISTRY_ADDRESS,
    bindingAuthorityAddress: env.VITE_PUBLIC_BINDING_AUTHORITY_ADDRESS,
  };
};

let directory: WorldDeployment[] | null = null;

export const getWorldDirectory = (): WorldDeployment[] => {
  if (!directory) {
    directory = [buildWorld(env.VITE_PUBLIC_CHAIN, "blitz")];
  }
  return directory;
};

export const getWorldById = (worldId: string | null | undefined): WorldDeployment | null =>
  worldId ? (getWorldDirectory().find((world) => world.id === worldId) ?? null) : null;

export const getDefaultWorld = (): WorldDeployment => getWorldDirectory()[0];
