import { getHyperstructureProgress } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { HyperstructureConstruction } from "./hyperstructure-design";

export function readHyperstructureConstruction(store: NativeFactStore, entityId: number): HyperstructureConstruction {
  const { percentage, completed } = getHyperstructureProgress(entityId, store);
  return { entityId, progress: percentage, completed };
}
