import type { Manifest } from "@bibliothecadao/types";

declare const __NATIVE_WORLD_MANIFEST__: Manifest;

/** The deployed release supplies addresses and schema together, once per build. */
export function getNativeManifest(): Manifest {
  if (typeof __NATIVE_WORLD_MANIFEST__ === "undefined") {
    throw new Error("Native release manifest was not supplied to the client build");
  }
  return __NATIVE_WORLD_MANIFEST__;
}
