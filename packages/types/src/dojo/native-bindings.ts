import type { Abi } from "starknet";

/** Generated protocol metadata; typed rows come from the native fact declarations. */
export interface NativeWorldBindings {
  schemaIdentity: string;
  commandAbi: Abi;
  events: { name: string; scope: "game" | "deployment" }[];
  models: { name: string; scope: "game" | "deployment" }[];
}
