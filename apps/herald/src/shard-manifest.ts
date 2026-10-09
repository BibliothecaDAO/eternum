import type { ShardManifest } from "@bibliothecadao/eternum/game-sync";
import type { NativeManifest } from "./native/schema";

/** The part of the deployment document the deployer records about the shard itself. */
export interface ShardRecord {
  chainId: string;
  accountClassHash: string;
  contracts: Record<string, string>;
  guardianPublicKey: string;
  /** The exact l2 gas bound of every play, which the shard's stamping endpoint enforces (canonical hex u64). */
  l2GasBound: string;
}

export type ShardDocument = NativeManifest & { shard: ShardRecord };

export interface ShardEndpoints {
  /** Where players send their signed invokes and read receipts: the shard's public, stamping endpoint. */
  rpcUrl: string;
}

/**
 * The deployment document as Herald reads it from disk: a shard record with a guardian key is required, since Realms
 * accounts accept device keys only under the guardian's signature and a shard without one cannot host them; so is the
 * play gas bound, since an invoke with any other bound is refused.
 */
export function readShardDocument(json: string): ShardDocument {
  const document = JSON.parse(json) as NativeManifest & { shard?: Partial<ShardRecord> };
  if (!document.shard) throw new Error("Deployment document has no shard record; redeploy with the current deployer");
  if (!/^0x[0-9a-f]{1,64}$/i.test(document.shard.guardianPublicKey ?? ""))
    throw new Error("Shard record has no guardian public key; initialize the shard with one");
  if (!/^0x[0-9a-f]{1,16}$/i.test(document.shard.l2GasBound ?? "") || BigInt(document.shard.l2GasBound!) === 0n)
    throw new Error("Shard record has no l2GasBound; initialize the shard with its play gas bound");
  return document as ShardDocument;
}

export function buildShardManifest(document: ShardDocument, endpoints: ShardEndpoints): ShardManifest {
  const { shard } = document;
  return {
    version: 1,
    chainId: shard.chainId,
    releaseSchemas: document.native.releaseSchemas,
    rpcUrl: endpoints.rpcUrl,
    accountClassHash: shard.accountClassHash,
    contracts: {
      ...shard.contracts,
      games: document.world.address,
    },
    guardianPublicKey: shard.guardianPublicKey,
    l2GasBound: shard.l2GasBound,
  };
}

/** A Herald pointed at another shard's node would serve that node's facts under this shard's name. */
export function assertShardChain(document: ShardDocument, nodeChainId: string): void {
  const declared = document.shard.chainId;
  if (BigInt(declared) !== BigInt(nodeChainId))
    throw new Error(`Herald's node reports chain ${nodeChainId} but the shard manifest declares ${declared}`);
}
