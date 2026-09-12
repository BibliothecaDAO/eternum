import type { Abi, CompiledSierra, CompiledSierraCasm } from "starknet";

export interface ClassArtifact {
  classHash: string;
  compiledClassHash: string;
  sierra: CompiledSierra;
  casm: CompiledSierraCasm;
}

export interface WorldProfile {
  namespace: { default: string };
  lib_versions: Record<string, string>;
  env: { rpc_url: string; account_address: string; private_key: string };
  world: { seed: string; name: string };
  writers: Record<string, string[]>;
  init_call_args?: Record<string, string[]>;
}

export interface LocalResource extends ClassArtifact {
  kind: "model" | "event" | "contract" | "library";
  name: string;
  namespace: string;
  tag: string;
  selector: string;
  systems: string[];
  members: Array<{ name: string; type: string; key: boolean }>;
  version?: string;
  initCalldata: string[];
}

export interface LocalWorld {
  profile: WorldProfile;
  world: ClassArtifact;
  resources: LocalResource[];
  address: string;
  salt: string;
}

export interface ResourceComparison {
  tag: string;
  kind: LocalResource["kind"] | "world";
  selector: string;
  localClassHash: string;
  chainClassHash: string | null;
  address: string | null;
  declared: boolean;
  initialized: boolean;
  action: "synced" | "deploy" | "register" | "upgrade" | "blocked";
}

export interface WorldPlan {
  worldAddress: string;
  blockNumber: number;
  resources: ResourceComparison[];
  namespaceRegistered: boolean;
  writers: Array<{ resource: string; contract: string; granted: boolean }>;
  blockers: string[];
}

export interface DeploymentReport {
  before: WorldPlan;
  after: WorldPlan;
  transactions: Array<{ action: string; resource: string; hash: string }>;
}

export interface WorldManifest {
  world: { address: string; class_hash: string; seed: string; name: string; entrypoints: string[]; abi: Abi };
  contracts: Array<{
    address: string;
    class_hash: string;
    init_calldata: string[];
    tag: string;
    selector: string;
    systems: string[];
  }>;
  libraries: Array<{ class_hash: string; tag: string; selector: string; systems: string[]; version: string }>;
  models: Array<{ class_hash: string; tag: string; selector: string; members: LocalResource["members"] }>;
  events: WorldManifest["models"];
  external_contracts: never[];
  abis: Abi;
}
