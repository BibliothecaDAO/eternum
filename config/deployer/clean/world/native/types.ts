import type { NativeRelease, NativeSchema } from "../../../../../apps/herald/src/native/schema";
import type { ShardRecord } from "../../../../../apps/herald/src/shard-manifest";
import type { ClassArtifact } from "../../shared/declare";
import type { Abi } from "starknet";

export interface NativeWorldManifest {
  native: NativeRelease;
  world: { address: string; class_hash: string; seed: string; name: string; entrypoints: string[]; abi: Abi };
  contracts: Array<{ address: string; class_hash: string; init_calldata: string[]; selector: string }>;
  abis: Abi;
  shard: ShardRecord;
}
/**
 * What the registrar, administrative commands and result recording read of a shard's world: its chain, Games
 * address and the schema it runs. A deployment document carries it all; so does a shard's public manifest together
 * with the schema this release was built with.
 */
export interface RegistrarWorld {
  native: Pick<NativeRelease, "activeSchema" | "schemas">;
  world: { address: string };
  shard: Pick<ShardRecord, "chainId">;
}

export interface NativeAuthentication {
  submitter: string;
  account_class: string;
}
export interface NativeLogic extends ClassArtifact {
  name: string;
}
export interface NativeGames extends ClassArtifact {
  address: string;
  salt: string;
  constructorCalldata: string[];
}
export interface NativeWorld {
  seed: string;
  authority: string;
  authentication: NativeAuthentication;
  schema: NativeSchema;
  games: NativeGames;
  logic: NativeLogic[];
  migration?: NativeLogic;
  release: NativeReleaseFacts;
  previous?: NativeWorldManifest;
}
export interface NativeReleaseFacts {
  releaseId: number;
  schema: string;
  migrationClassHash: string;
  classes: { games: string; logic: Record<string, string>; account: string };
}
export interface NativeClassPlan {
  name: string;
  classHash: string;
  declared: boolean;
}
export interface NativePlan {
  worldAddress: string;
  blockNumber: number;
  classes: NativeClassPlan[];
  deployedClassHash: string | null;
  realmCatalogue?: { initialized: number; digest: string };
  releaseRegistered: boolean;
  blockers: string[];
  synced: boolean;
}
export interface NativeTransaction {
  action: "declare" | "deploy" | "initialize_realm_traits" | "register_release" | "apply_release";
  domain: string;
  hash: string;
}
