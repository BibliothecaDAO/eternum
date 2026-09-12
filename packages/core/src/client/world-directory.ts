import type { GameChain as Chain } from "@realms-world/chain";
import { resolveEndpoint } from "@realms-world/chain";

import { namespaceForChain, type GameNamespace } from "./game-scope";
import { normalizeSelector } from "./normalize";

/**
 * The world directory — the client's single source of "what worlds exist".
 *
 * A world is one deployed world contract plus its Herald stream; games (Blitz)
 * and seasons (Eternum) are GameRegistry rows inside a world. Phase two
 * exposes the one persistent Blitz world indexed by Herald.
 *
 * The host (web client, headless runner) builds its worlds from committed
 * manifests and its own configuration, then installs them here; every
 * consumer reads through the getters.
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

/** The slice of a Dojo manifest a world deployment is built from. */
export interface CommittedManifest {
  world: { address: string };
  contracts: { selector: string; address: string }[];
}

interface WorldDeploymentInput {
  id: string;
  chain: Chain;
  manifest: CommittedManifest;
  heraldBaseUrl: string;
  rpcUrl: string;
  /** Whether the endpoints must be reachable from a browser page (mixed-content rules apply). */
  browserFacing: boolean;
  playerAccountClassHash: string;
  playerRegistryAddress: string;
  bindingAuthorityAddress: string;
}

export const buildWorldDeployment = (input: WorldDeploymentInput): WorldDeployment => ({
  id: input.id,
  chain: input.chain,
  heraldBaseUrl: resolveEndpoint(input.heraldBaseUrl, {
    name: `Herald URL for world "${input.id}"`,
    browserFacing: input.browserFacing,
  }),
  rpcUrl: resolveEndpoint(input.rpcUrl, {
    name: `RPC URL for world "${input.id}"`,
    browserFacing: input.browserFacing,
  }),
  namespace: namespaceForChain(input.chain),
  worldAddress: input.manifest.world.address,
  contractsBySelector: indexContractsBySelector(input.manifest),
  playerAccountClassHash: input.playerAccountClassHash,
  playerRegistryAddress: input.playerRegistryAddress,
  bindingAuthorityAddress: input.bindingAuthorityAddress,
});

const indexContractsBySelector = (manifest: CommittedManifest): Record<string, string> =>
  Object.fromEntries(manifest.contracts.map((contract) => [normalizeSelector(contract.selector), contract.address]));

let resolveDirectory: (() => WorldDeployment[]) | null = null;
let directory: WorldDeployment[] | null = null;

/**
 * Register the host's worlds. The factory runs on first read so a host can
 * install at import time without building manifests eagerly.
 */
export const installWorldDirectory = (resolve: () => WorldDeployment[]): void => {
  resolveDirectory = resolve;
  directory = null;
};

export const getWorldDirectory = (): WorldDeployment[] => {
  if (!resolveDirectory) {
    throw new Error("World directory not installed: call installWorldDirectory() before reading worlds");
  }
  directory ??= resolveDirectory();
  return directory;
};

export const getWorldById = (worldId: string | null | undefined): WorldDeployment | null =>
  worldId ? (getWorldDirectory().find((world) => world.id === worldId) ?? null) : null;

export const getDefaultWorld = (): WorldDeployment => getWorldDirectory()[0];
