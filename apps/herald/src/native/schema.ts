import { createHash } from "node:crypto";
import type { NativeReleases } from "@bibliothecadao/eternum/game-sync";
import type { Abi } from "starknet";

export interface NativeMember {
  name: string;
  type: string;
  wireId?: number;
  id?: string;
  feltLength?: number | null;
}
export interface NativeModel {
  name: string;
  identity: string;
  scope: "game" | "deployment";
  emitterKey?: string;
  derivedFrom?: "preset";
  keys: NativeMember[];
  members: NativeMember[];
  keyLength: number;
  valueLength: number | null;
  observation?: { domain: string; fields: Record<string, string>; transform?: "production" };
}
export interface NativeEventLayout {
  name: string;
  prefix: string[];
  members: (NativeMember & { kind: "key" | "data" })[];
}
export interface NativeSchema {
  identity: string;
  version: number;
  cairoVersion: string;
  logicClasses: { slot: number; name: string; contract: string }[];
  encoding: string;
  games: {
    contract: string;
    events: NativeEventLayout[];
    entrypoints: { name: string; inputs: NativeMember[] }[];
  };
  models: NativeModel[];
  types: Record<
    string,
    { type: "struct"; name: string; members: NativeMember[] } | { type: "enum"; name: string; variants: NativeMember[] }
  >;
  events: {
    name: string;
    scope: "game" | "deployment";
    version: number;
    event: NativeEventLayout;
  }[];
}
export interface NativeRelease {
  version: 2;
  deploymentBlock: number;
  activeSchema: string;
  schemas: Record<string, NativeSchema>;
  gamesClassHash: string;
  verifierClassHash?: string;
  migrationClassHash: string;
  releaseId: number;
  releases: NativeReleases;
  releaseBalances?: Record<string, string>;
  logic: Record<string, string>;
}
export interface NativeManifest {
  world: { address: string };
  native: NativeRelease;
}

export function schemaIdentity(schema: NativeSchema): string {
  const { identity: _, ...content } = schema;
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}
export function schemaAbi(schema: NativeSchema): Abi {
  return Object.values(schema.types) as Abi;
}
