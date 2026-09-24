import type { ShardManifest } from "@bibliothecadao/eternum/game-sync";
import type { NativeManifest } from "./native/schema";

/** The part of the deployment document the deployer records about the shard itself. */
export interface ShardRecord {
  chainId: string;
  accountClassHash: string;
  contracts: Record<string, string>;
  guardianPublicKey: string;
}

export type ShardDocument = NativeManifest & { shard?: ShardRecord };

export interface ShardEndpoints {
  rpcUrl: string;
  admissionUrl: string;
}

export function buildShardManifest(document: ShardDocument, endpoints: ShardEndpoints): ShardManifest {
  const shard = requireShardRecord(document);
  return {
    version: 1,
    chainId: shard.chainId,
    releaseSchemas: document.native.releaseSchemas,
    rpcUrl: endpoints.rpcUrl,
    admissionUrl: endpoints.admissionUrl,
    accountClassHash: shard.accountClassHash,
    contracts: {
      ...shard.contracts,
      games: document.world.address,
    },
    guardianPublicKey: shard.guardianPublicKey,
  };
}

/** A Herald pointed at another shard's node would serve that node's facts under this shard's name. */
export function assertShardChain(document: ShardDocument, nodeChainId: string): void {
  const declared = requireShardRecord(document).chainId;
  if (BigInt(declared) !== BigInt(nodeChainId))
    throw new Error(`Herald's node reports chain ${nodeChainId} but the shard manifest declares ${declared}`);
}

function requireShardRecord(document: ShardDocument): ShardRecord {
  if (!document.shard) throw new Error("Deployment document has no shard record; redeploy with the current deployer");
  // Realms accounts accept device keys only under the guardian's signature, so a shard without one cannot host them.
  if (!/^0x[0-9a-f]{1,64}$/i.test(document.shard.guardianPublicKey ?? ""))
    throw new Error("Shard record has no guardian public key; initialize the shard with one");
  return document.shard;
}
