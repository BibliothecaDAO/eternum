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

function parseChunkKey(chunkKey: string): { row: number; col: number } {
  const [row, col] = chunkKey.split(",").map(Number);
  return { row, col };
}

export function resolveWarpTravelDirectionalPrefetchPlan(input: ResolveWarpTravelDirectionalPrefetchPlanInput): {
  desiredAreaKeys: string[];
  chunkKeysToEnqueue: string[];
  presentationChunkKeysToPrewarm: string[];
  nextPrefetchedAhead: string[];
} {
  if (!input.anchor) {
    return {
      desiredAreaKeys: [],
      chunkKeysToEnqueue: [],
      presentationChunkKeysToPrewarm: [],
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
  const { row: forwardRow, col: forwardCol } = parseChunkKey(input.anchor.forwardChunkKey);
  const presentationChunkKeysToPrewarm: string[] = [];

  for (let forwardStride = 0; forwardStride <= Math.min(1, input.forwardDepthStrides); forwardStride += 1) {
    const row =
      input.anchor.movementAxis === "z"
        ? forwardRow + forwardStride * input.anchor.movementSign * input.chunkSize
        : forwardRow;
    const col =
      input.anchor.movementAxis === "x"
        ? forwardCol + forwardStride * input.anchor.movementSign * input.chunkSize
        : forwardCol;
    const chunkKey = `${row},${col}`;
    if (!input.pinnedChunkKeys.has(chunkKey) && chunkKey !== input.currentChunk) {
      presentationChunkKeysToPrewarm.push(chunkKey);
    }
  }

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
    presentationChunkKeysToPrewarm,
    nextPrefetchedAhead,
  };
}
