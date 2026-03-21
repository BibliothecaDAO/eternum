import type { FactoryLaunchChain } from "../types";

export type FactoryDeveloperContractTargetId = "prize-address" | "custom";

export interface FactoryDeveloperContractTarget {
  id: FactoryDeveloperContractTargetId;
  label: string;
  manifestTag?: string;
  allowsCustomInput: boolean;
}

export interface FactoryManifestContractLookupRequest {
  chain: FactoryLaunchChain;
  worldName: string;
  manifestContractName: string;
}

export interface FactoryManifestContractLookupSuccess {
  kind: "success";
  worldName: string;
  resolvedTag: string;
  worldAddress: string;
  contractAddress: string;
}

export interface FactoryManifestContractLookupFailure {
  kind: "failure";
  code: "world_not_found" | "contract_not_found" | "factory_unavailable";
  message: string;
  worldSuggestions?: string[];
  contractSuggestions?: string[];
}

export type FactoryManifestContractLookupResult =
  | FactoryManifestContractLookupSuccess
  | FactoryManifestContractLookupFailure;
