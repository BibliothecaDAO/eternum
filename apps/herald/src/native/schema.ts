import { createHash } from "node:crypto";
import type { Abi } from "starknet";

export interface NativeMember {
  name: string;
  type: string;
  id?: string;
  feltLength?: number | null;
}
export interface NativeModel {
  name: string;
  identity: string;
  owners: string[];
  scope: "game" | "deployment";
  emitterKey?: string;
  keys: NativeMember[];
  members: NativeMember[];
  keyLength: number;
  valueLength: number | null;
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
  encoding: string;
  domains: Record<
    string,
    {
      contract: string;
      systems?: string[];
      events: NativeEventLayout[];
      entrypoints: { name: string; inputs: NativeMember[] }[];
    }
  >;
  models: NativeModel[];
  absentCollections: string[];
  types: Record<
    string,
    { type: "struct"; name: string; members: NativeMember[] } | { type: "enum"; name: string; variants: NativeMember[] }
  >;
  projections: {
    name: string;
    owners: string[];
    scope: "game";
    version: number;
    derivedRows: string[];
    event: NativeEventLayout;
  }[];
}
export interface NativeRelease {
  version: 1;
  deploymentBlock: number;
  activeSchema: string;
  schemas: Record<string, NativeSchema>;
  domains: Record<string, { address: string; initialClassHash: string; classes: Record<string, string> }>;
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
