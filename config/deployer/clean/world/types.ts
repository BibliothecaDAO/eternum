import type { Abi } from "starknet";

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
  models: Array<{
    class_hash: string;
    tag: string;
    selector: string;
    members: Array<{ name: string; type: string; key: boolean }>;
  }>;
  events: WorldManifest["models"];
  external_contracts: never[];
  abis: Abi;
}
