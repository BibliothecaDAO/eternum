import type { Abi } from "starknet";
/** Generated from the native domain ABIs; the shared bootstrap installs these into its existing RECS world. */
export interface NativeWorldBindings {
  schemaIdentity: string;
  commandAbi: Abi;
  events: { name: string; scope: "game" | "deployment" }[];
  models: { name: string; scope: "game" | "deployment"; schema: Record<string, NativeRecsType> }[];
}
export type NativeRecsType =
  | "OptionalNumber"
  | "Boolean"
  | "Number"
  | "BigInt"
  | "String"
  | [NativeRecsType]
  | { [key: string]: NativeRecsType };
