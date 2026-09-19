import bindings from "../../../../../contracts/l3/world-native/schema/bindings.json";
import type { Manifest, NativeWorldBindings } from "@bibliothecadao/types";

export const nativeBindings = bindings as unknown as NativeWorldBindings;

declare const __NATIVE_WORLD_MANIFEST__: Manifest;

/** The deployed release supplies addresses and schema together, once per build. */
export function getNativeManifest(): Manifest {
  if (typeof __NATIVE_WORLD_MANIFEST__ === "undefined") {
    throw new Error("Native release manifest was not supplied to the client build");
  }
  return __NATIVE_WORLD_MANIFEST__;
}
