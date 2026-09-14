import type { NativeRelease, NativeSchema } from "../../../../../apps/herald/src/native/schema";
import type { ClassArtifact } from "../../shared/declare";
import type { WorldManifest } from "../types";

export type NativeWorldManifest = WorldManifest & { native: NativeRelease };
export interface NativeAuthentication {
  submitter: string;
  registry: string;
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
}
export interface NativePlan {
  worldAddress: string;
  blockNumber: number;
  domains: NativeDomainPlan[];
  blockers: string[];
  synced: boolean;
}
export interface NativeTransaction {
  action: "declare" | "deploy" | "configure" | "activate" | "upgrade";
  domain: string;
  hash: string;
}
