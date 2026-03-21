import type { RawArgsArray } from "starknet";

import type { FactoryLaunchChain } from "../types";

export type FactoryDeveloperContractTargetId = "prize-address" | "custom";
export type FactoryConfigSectionId = "base" | "contracts" | "models" | "events" | "libraries";

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

export interface FactoryDeveloperConfigSection {
  id: FactoryConfigSectionId;
  label: string;
  entrypoint: string;
  description: string;
  itemCount?: number;
  calldata: RawArgsArray;
}

export interface FactoryDeveloperConfigDraft {
  factoryAddress: string;
  version: string;
  namespace: string;
  sections: FactoryDeveloperConfigSection[];
}

export type FactoryDeveloperConfigExecutionState =
  | {
      status: "idle";
    }
  | {
      status: "sending";
    }
  | {
      status: "submitted";
      txHash: string;
    }
  | {
      status: "confirmed";
      txHash: string;
    }
  | {
      status: "error";
      message: string;
      txHash?: string;
    };

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
