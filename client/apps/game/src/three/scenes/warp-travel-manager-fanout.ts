export interface WarpTravelManagerFanoutOptions {
  force?: boolean;
  transitionToken?: number;
}

export interface WarpTravelChunkManager {
  label: string;
  updateChunk: (chunkKey: string, options?: WarpTravelManagerFanoutOptions) => Promise<void>;
}

export interface WarpTravelManagerFanoutFailure {
  label: string;
  reason: unknown;
}

export async function runWarpTravelManagerFanout(input: {
  chunkKey: string;
  options?: WarpTravelManagerFanoutOptions;
  managers: WarpTravelChunkManager[];
  onManagerFailed?: (label: string, reason: unknown) => void;
}): Promise<{ failedManagers: WarpTravelManagerFanoutFailure[] }> {
  const results = await Promise.allSettled(
    input.managers.map((manager) => manager.updateChunk(input.chunkKey, input.options)),
  );

  const failedManagers: WarpTravelManagerFanoutFailure[] = [];
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const label = input.managers[index].label;
      failedManagers.push({
        label,
        reason: result.reason,
      });
      input.onManagerFailed?.(label, result.reason);
    }
  });

  return {
    failedManagers,
  };
}
