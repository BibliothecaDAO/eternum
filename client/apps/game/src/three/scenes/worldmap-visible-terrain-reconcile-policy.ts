import type { VisibleTerrainInstanceRef } from "./worldmap-visible-terrain-membership";

export type VisibleTerrainReconcileMode =
  | "none"
  | "append_if_absent"
  | "replace_same_hex"
  | "remove_same_hex"
  | "atomic_chunk_refresh";

interface ResolveVisibleTerrainReconcileModeInput {
  isVisibleInCurrentChunk: boolean;
  currentOwner: Pick<VisibleTerrainInstanceRef, "biomeKey"> | null;
  nextBiomeKey: string;
  canDirectReplace: boolean;
}

export function resolveVisibleTerrainReconcileMode(
  input: ResolveVisibleTerrainReconcileModeInput,
): VisibleTerrainReconcileMode {
  if (!input.isVisibleInCurrentChunk) {
    return "none";
  }

  if (!input.currentOwner) {
    return "append_if_absent";
  }

  if (input.currentOwner.biomeKey === input.nextBiomeKey) {
    return "none";
  }

  if (input.canDirectReplace) {
    return "replace_same_hex";
  }

  return "atomic_chunk_refresh";
}
