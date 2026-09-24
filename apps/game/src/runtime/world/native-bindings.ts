import bindings from "../../../../../contracts/l3/world-native/schema/bindings.json";
import type { NativeWorldBindings } from "@bibliothecadao/types";

/** The fact schema this client was compiled against; a shard serving another schema is refused. */
export const nativeBindings = bindings as unknown as NativeWorldBindings;
