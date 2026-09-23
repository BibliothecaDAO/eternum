import type { NativeRelease, NativeSchema } from "../../../../../apps/herald/src/native/schema";
import type { ShardRecord } from "../../../../../apps/herald/src/shard-manifest";
import type { ClassArtifact } from "../../shared/declare";
import type { Abi } from "starknet";

export interface NativeWorldManifest {
  native: NativeRelease;
  world: { address: string; class_hash: string; seed: string; name: string; entrypoints: string[]; abi: Abi };
  contracts: Array<{
    address: string;
    class_hash: string;
    init_calldata: string[];
    selector: string;
  }>;
  abis: Abi;
  shard: ShardRecord;
}
/**
 * What the registrar, administrative commands and result recording read of a shard's world: its chain, its domain
 * addresses and the schema they run. A deployment document carries it all; so does a shard's public manifest together
 * with the schema this release was built with.
 */
export interface RegistrarWorld {
  native: Pick<NativeRelease, "activeSchema" | "schemas"> & { domains: Record<string, { address: string }> };
  world: { address: string };
  shard: Pick<ShardRecord, "chainId">;
}

export interface NativeAuthentication {
  submitter: string;
  account_class: string;
}
export interface NativeDomain extends ClassArtifact {
  name: string;
  address: string;
  salt: string;
  constructorCalldata: string[];
}
export interface NativeWorld {
  seed: string;
  authority: string;
  authentication: NativeAuthentication;
  schema: NativeSchema;
  domains: NativeDomain[];
  previous?: NativeWorldManifest;
}
export interface NativeDomainPlan {
  name: string;
  address: string;
  localClassHash: string;
  chainClassHash: string | null;
  configured: boolean;
  active: boolean;
  declared: boolean;
  realmCatalogue?: { initialized: number; digest: string };
}
export interface NativePlan {
  worldAddress: string;
  blockNumber: number;
  domains: NativeDomainPlan[];
  blockers: string[];
  synced: boolean;
}
export interface NativeTransaction {
  action: "declare" | "deploy" | "configure" | "activate" | "upgrade" | "initialize_realm_traits";
  domain: string;
  hash: string;
}
