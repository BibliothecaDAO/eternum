import { deriveDirectionalPrefetchChunkKeys } from "./worldmap-directional-prefetch-policy";

interface WarpTravelDirectionalPrefetchAnchor {
  forwardChunkKey: string;
  movementAxis: "x" | "z";
  movementSign: -1 | 1;
}

interface ResolveWarpTravelDirectionalPrefetchPlanInput {
  anchor: WarpTravelDirectionalPrefetchAnchor | null;
  chunkSize: number;
  forwardDepthStrides: number;
  sideRadiusStrides: number;
  pinnedChunkKeys: Set<string>;
  currentChunk: string;
  prefetchedAhead: string[];
  maxPrefetchedAhead: number;
  getRenderAreaKeyForChunk: (chunkKey: string) => string;
}

export function resolveWarpTravelDirectionalPrefetchPlan(
  input: ResolveWarpTravelDirectionalPrefetchPlanInput,
): {
  desiredAreaKeys: string[];
  chunkKeysToEnqueue: string[];
  nextPrefetchedAhead: string[];
} {
  if (!input.anchor) {
    return {
      desiredAreaKeys: [],
      chunkKeysToEnqueue: [],
      nextPrefetchedAhead: [],
    };
  }

  const prefetchTargets = deriveDirectionalPrefetchChunkKeys({
    forwardChunkKey: input.anchor.forwardChunkKey,
    chunkSize: input.chunkSize,
    forwardDepthStrides: input.forwardDepthStrides,
    sideRadiusStrides: input.sideRadiusStrides,
    movementAxis: input.anchor.movementAxis,
    movementSign: input.anchor.movementSign,
  });

  const desiredAreaKeys: string[] = [];
  const nextPrefetchedAhead = [...input.prefetchedAhead];
  const chunkKeysToEnqueue: string[] = [];

  prefetchTargets.forEach((chunkKey) => {
    if (input.pinnedChunkKeys.has(chunkKey) || chunkKey === input.currentChunk) {
      return;
    }

    desiredAreaKeys.push(input.getRenderAreaKeyForChunk(chunkKey));
    if (nextPrefetchedAhead.includes(chunkKey)) {
      return;
    }

    nextPrefetchedAhead.push(chunkKey);
    while (nextPrefetchedAhead.length > input.maxPrefetchedAhead) {
      nextPrefetchedAhead.shift();
    }
    chunkKeysToEnqueue.push(chunkKey);
  });

  return {
    desiredAreaKeys,
    chunkKeysToEnqueue,
    nextPrefetchedAhead,
  };
}
